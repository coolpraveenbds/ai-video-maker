import express from "express";
import multer from "multer";
import cors from "cors";
import Replicate from "replicate";
import rateLimit from "express-rate-limit";

const app = express();

app.use(cors());
app.use(express.json());

app.set("trust proxy", 1);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10
});

app.use(limiter);

const upload = multer({ dest: "uploads/" });

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

let queue = [];
let processing = false;

function checkAdult(prompt) {

  const banned = [
    "nude",
    "sex",
    "porn",
    "naked",
    "adult",
    "xxx"
  ];

  const text = prompt.toLowerCase();

  for (let word of banned) {
    if (text.includes(word)) return true;
  }

  return false;
}

async function processQueue() {

  if (processing) return;

  if (queue.length === 0) return;

  processing = true;

  const job = queue.shift();

  try {

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          image: job.image,
          prompt: job.prompt,
          duration: 5,
          fps: 24,
          resolution: "720p",
          aspect_ratio: "16:9"
        }
      }
    );

    const videoUrl = output[0];

    const watermarkedVideo =
      videoUrl + "?watermark=AI-VIDEO-MAKER";

    job.res.json({
      status: "success",
      video: watermarkedVideo
    });

  } catch (err) {

    job.res.status(500).json({
      error: err.message
    });

  }

  processing = false;

  processQueue();
}

app.get("/", (req, res) => {

  res.send("AI Video Maker Backend Running");

});

app.post("/generate", upload.single("image"), async (req, res) => {

  try {

    const prompt = req.body.prompt || "cinematic camera movement";

    if (checkAdult(prompt)) {

      return res.status(400).json({
        error: "Adult content detected"
      });

    }

    const imageUrl =
      "https://replicate.delivery/pbxt/sample.jpg";

    queue.push({
      image: imageUrl,
      prompt: prompt,
      res: res
    });

    processQueue();

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log("Server running on port " + PORT);

});