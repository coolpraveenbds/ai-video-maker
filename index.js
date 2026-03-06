import express from "express";
import multer from "multer";
import cors from "cors";
import Replicate from "replicate";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/", (req, res) => {
  res.send("AI Video Maker Server is Live 🚀");
});

app.post("/generate", upload.single("image"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    console.log("📤 Uploading image to Cloudinary...");

    const imageUpload = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "image",
    });

    const imageUrl = imageUpload.secure_url;

    fs.unlinkSync(req.file.path);

    console.log("🎬 Generating video with Seedance...");

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          image: imageUrl,
          prompt: "cinematic portrait motion video"
        },
      }
    );

    const videoUrl = Array.isArray(output) ? output[0] : output;

    console.log("☁️ Uploading video to Cloudinary...");

    const videoUpload = await cloudinary.uploader.upload(videoUrl, {
      resource_type: "video",
      public_id: "ai_video_" + Date.now(),
      transformation: [
        { width: 1280, crop: "scale" },
        {
          overlay: {
            font_family: "Arial",
            font_size: 40,
            text: "AI VIDEO MAKER"
          },
          gravity: "south_east",
          x: 20,
          y: 20,
          opacity: 70
        }
      ]
    });

    console.log("✅ Video generated successfully");

    res.json({
      video: videoUpload.secure_url
    });

  } catch (error) {

    console.error("❌ ERROR:", error);

    res.status(500).json({
      error: error.message
    });

  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});