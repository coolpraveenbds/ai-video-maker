import express from "express";
import cors from "cors";
import multer from "multer";
import Replicate from "replicate";
import rateLimit from "express-rate-limit";
import fs from "fs";

const app = express();

app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* Rate limit protection */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10
});

app.use(limiter);

/* Image upload */
const upload = multer({ dest: "uploads/" });

/* Replicate client */
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

/* Home route */
app.get("/", (req, res) => {
  res.send("AI Video Maker Backend Running");
});

/* Upload API */
app.post("/upload", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({ error: "Image missing" });
    }

    const imagePath = req.file.path;

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          image: fs.createReadStream(imagePath),
          prompt: "cinematic movement",
          duration: 5,
          fps: 24,
          resolution: "720p",
          aspect_ratio: "16:9"
        }
      }
    );

    /* Delete temp file */
    fs.unlinkSync(imagePath);

    /* Extract video url */
    let videoUrl = "";

    if (Array.isArray(output)) {
      videoUrl = output[0];
    } else if (typeof output === "string") {
      videoUrl = output;
    } else if (output?.url) {
      videoUrl = output.url();
    }

    res.json({
      status: "success",
      video: videoUrl
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      status: "error",
      message: error.message
    });

  }

});

/* Start server */
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});