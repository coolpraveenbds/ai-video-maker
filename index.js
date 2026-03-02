import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import Replicate from "replicate";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

app.use(express.json());

// ====== MULTER SETUP ======
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ====== REPLICATE TOKEN ======
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// ====== ROOT ROUTE ======
app.get("/", (req, res) => {
  res.send("AI Video Server Running (With Basic Safety Check)");
});

// ====== UPLOAD ROUTE ======
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    console.log("Image received. Checking safety...");

    // Convert image buffer to base64
    const base64Image = req.file.buffer.toString("base64");
    const imageData = `data:${req.file.mimetype};base64,${base64Image}`;

    // ====== BASIC SAFETY CHECK (Caption Based) ======
    const caption = await replicate.run(
      "salesforce/blip-image-captioning-base",
      {
        input: { image: imageData },
      }
    );

    const captionText = caption.join(" ").toLowerCase();

    console.log("Image caption:", captionText);

    if (
      captionText.includes("nude") ||
      captionText.includes("sex") ||
      captionText.includes("explicit")
    ) {
      return res.status(400).json({
        error: "Adult or inappropriate content detected",
      });
    }

    console.log("Image safe. Generating video...");

    // ====== VIDEO GENERATION MODEL ======
    const output = await replicate.run(
      "stability-ai/stable-video-diffusion",
      {
        input: {
          image: imageData,
          motion_bucket_id: 127,
          fps: 6,
        },
      }
    );

    console.log("Video generated:", output);

    return res.json({
      success: true,
      videoUrl: output[0],
    });
  } catch (error) {
    console.error("Server error:", error);
    return res.status(500).json({
      error: "Video generation failed",
    });
  }
});

// ====== START SERVER ======
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
