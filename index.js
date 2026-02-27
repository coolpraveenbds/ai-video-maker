const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const Replicate = require('replicate');

const app = express();
const PORT = process.env.PORT || 10000;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const watermarkedDir = path.join(__dirname, 'watermarked');
if (!fs.existsSync(watermarkedDir)) fs.mkdirSync(watermarkedDir);

app.use('/videos', express.static(watermarkedDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, `input-${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({ storage });

app.get('/', (req, res) => {
  res.send("AI Video Server Running (With NSFW Protection)");
});

app.post('/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const addWatermark = req.body.add_watermark === 'true';

  try {

    const imageFile = await fs.promises.readFile(req.file.path);
    const imageDataUri = `data:${req.file.mimetype};base64,${imageFile.toString("base64")}`;

    console.log("🔎 Checking image safety...");

    // 🔐 NSFW CHECK MODEL
    const nsfwResult = await replicate.run(
      "openai/moderation",
      {
        input: { input: imageDataUri }
      }
    );

    if (nsfwResult.results?.[0]?.category_scores?.sexual > 0.5) {
      console.log("❌ NSFW content detected. Blocking.");
      return res.status(400).json({
        message: "Inappropriate content detected. Adult content is not allowed."
      });
    }

    console.log("✅ Image is safe. Generating video...");

    // 🎬 Generate video
    const modelIdentifier = "seedance/seedance-1.0";

    const replicateOutputUrl = await replicate.run(modelIdentifier, {
      input: { input_image: imageDataUri }
    });

    if (!addWatermark) {
      return res.json({
        message: "Video generated successfully",
        videoUrl: replicateOutputUrl
      });
    }

    // 💧 Watermark section
    const tempDownloadedPath = path.join(uploadsDir, `temp_${Date.now()}.mp4`);
    const watermarkedFileName = `watermarked_${Date.now()}.mp4`;
    const finalOutputPath = path.join(watermarkedDir, watermarkedFileName);

    await downloadFile(replicateOutputUrl, tempDownloadedPath);

    const watermarkText = "AI Video Maker";

    const ffmpegCommand = `ffmpeg -i "${tempDownloadedPath}" -vf "drawtext=text='${watermarkText}':x=(w-text_w)/2:y=H-th-20:fontsize=24:fontcolor=white@0.8" "${finalOutputPath}"`;

    exec(ffmpegCommand, (error) => {
      if (error) {
        return res.status(500).json({ message: "Watermark failed." });
      }

      const finalVideoUrl = `https://${req.hostname}/videos/${watermarkedFileName}`;

      res.json({
        message: "Video generated with watermark",
        videoUrl: finalVideoUrl
      });

      fs.unlinkSync(tempDownloadedPath);
    });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      message: "Video generation failed.",
      error: error.message
    });
  } finally {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
  }
});

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, response => {
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", err => {
      fs.unlink(dest, () => {});
      reject(err.message);
    });
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});