import express from "express";
import multer from "multer";
import cors from "cors";
import Replicate from "replicate";
import dotenv from "dotenv";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.get("/", (req, res) => {
  res.send("AI Video Maker Server Running 🚀");
});

app.post("/generate", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    console.log("Image received");

    const imageBuffer = fs.readFileSync(req.file.path);

    const base64Image =
      "data:" + req.file.mimetype + ";base64," + imageBuffer.toString("base64");

    console.log("Starting Seedance video generation");

    const prediction = await replicate.predictions.create({
      model: "bytedance/seedance-1-lite",
      input: {
        image: base64Image,
        prompt: "cinematic motion"
      }
    });

    let result = prediction;

    while (result.status !== "succeeded" && result.status !== "failed") {

      console.log("Status:", result.status);

      await new Promise(resolve => setTimeout(resolve, 3000));

      result = await replicate.predictions.get(result.id);
    }

    if (result.status === "failed") {
      console.log("AI generation failed");
      return res.status(500).json({ error: "Video generation failed" });
    }

    const videoUrl = Array.isArray(result.output)
      ? result.output[0]
      : result.output;

    console.log("Video generated from Replicate:", videoUrl);

    // Upload video to Cloudinary
    const uploadResponse = await cloudinary.uploader.upload(videoUrl, {
      resource_type: "video",
      public_id: "ai_video_" + Date.now()
    });

    console.log("Uploaded to Cloudinary");

    fs.unlinkSync(req.file.path);

    res.json({
      status: "success",
      video_url: uploadResponse.secure_url
    });

  } catch (error) {

    console.log("Server error:", error);

    res.status(500).json({
      error: "Server error"
    });

  }

});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});