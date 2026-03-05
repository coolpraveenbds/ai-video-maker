import express from "express";
import multer from "multer";
import cors from "cors";
import Replicate from "replicate";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import rateLimit from "express-rate-limit";
import Queue from "p-queue";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

/* Rate Limit Protection */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5
});

app.use(limiter);

/* Queue System */
const queue = new Queue({ concurrency: 1 });

/* Replicate */
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

/* Cloudinary */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* Adult Filter */
function isAdultPrompt(prompt) {

  const badWords = [
    "nude",
    "sex",
    "porn",
    "naked",
    "xxx",
    "adult"
  ];

  return badWords.some(word => prompt.toLowerCase().includes(word));

}

/* Home */
app.get("/", (req, res) => {
  res.send("AI Video Maker Backend Running");
});

/* Generate Video */
app.post("/generate", upload.single("image"), async (req, res) => {

  try {

    const prompt = req.body.prompt || "cinematic camera movement";

    if (isAdultPrompt(prompt)) {
      return res.status(400).json({
        error: "Adult content not allowed"
      });
    }

    const task = await queue.add(async () => {

      const uploadResult = await cloudinary.uploader.upload(req.file.path);

      const imageUrl = uploadResult.secure_url;

      const output = await replicate.run(
        "bytedance/seedance-1-lite",
        {
          input: {
            image: imageUrl,
            prompt: prompt
          }
        }
      );

      fs.unlinkSync(req.file.path);

      const videoUrl = Array.isArray(output) ? output[0] : output;

      return videoUrl;

    });

    res.json({
      video: task,
      watermark: "AI Video Maker"
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: err.message
    });

  }

});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});