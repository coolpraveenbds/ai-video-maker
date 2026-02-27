const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { exec } = require("child_process");
const Replicate = require("replicate");

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Replicate (IMPORTANT)
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Middleware
app.use(cors());
app.use(express.json());

// Create directories if not exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const watermarkedDir = path.join(__dirname, "watermarked");
if (!fs.existsSync(watermarkedDir)) fs.mkdirSync(watermarkedDir);

// Serve watermarked videos
app.use("/videos", express.static(watermarkedDir));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, `input-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage });

// Health check
app.get("/", (req, res) => {
  res.send("🚀 AI Video Server with Watermark is running");
});

// MAIN ROUTE
app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const addWatermark = req.body.add_watermark === "true";

  console.log(`📸 Image received. Watermark required: ${addWatermark}`);

  try {
    // Convert image to base64
    const imageFile = await fs.promises.readFile(req.file.path);
    const imageDataUri = `data:${req.file.mimetype};base64,${imageFile.toString("base64")}`;

    console.log("🚀 Sending to Replicate...");

    // Generate video
    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          prompt: "Animate this image with cinematic motion",
          image: imageDataUri,
        },
      }
    );

    const replicateVideoUrl =
      typeof output === "string" ? output : output.url();

    console.log("✅ Replicate video URL:", replicateVideoUrl);

    // PREMIUM USER → send original
    if (!addWatermark) {
      return res.json({
        message: "Video generated successfully",
        videoUrl: replicateVideoUrl,
      });
    }

    // FREE USER → download & watermark
    const tempVideoPath = path.join(
      uploadsDir,
      `temp_video_${Date.now()}.mp4`
    );

    const finalFileName = `watermarked_${Date.now()}.mp4`;
    const finalOutputPath = path.join(watermarkedDir, finalFileName);

    await downloadFile(replicateVideoUrl, tempVideoPath);

    console.log("💧 Applying watermark...");

    const ffmpegCommand = `ffmpeg -y -i "${tempVideoPath}" -vf "drawtext=text='AI Video Maker':fontcolor=white@0.6:fontsize=28:x=w-tw-20:y=h-th-20" -codec:a copy "${finalOutputPath}"`;

    exec(ffmpegCommand, (error) => {
      if (error) {
        console.error("❌ FFMPEG error:", error);
        return res
          .status(500)
          .json({ message: "Failed to apply watermark." });
      }

      const finalVideoUrl = `${req.protocol}://${req.get(
        "host"
      )}/videos/${finalFileName}`;

      console.log("✅ Watermarked video ready:", finalVideoUrl);

      res.json({
        message: "Video generated successfully with watermark",
        videoUrl: finalVideoUrl,
      });

      // Cleanup temp file
      if (fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      message: "Video generation failed",
      error: error.message,
    });
  } finally {
    // Cleanup uploaded image
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Helper function
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(
          `Failed to download: ${response.statusCode}`
        );
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close(resolve);
      });

      file.on("error", (err) => {
        fs.unlink(dest, () => reject(err.message));
      });
    });
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
