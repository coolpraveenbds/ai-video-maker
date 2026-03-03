const express = require("express");
const multer = require("multer");
const cors = require("cors");
const Replicate = require("replicate");

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

app.get("/", (req, res) => {
  res.send("AI Video Server Running 🚀");
});

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    console.log("Generating video...");

    const output = await replicate.run(
      "stability-ai/stable-video-diffusion",
      {
        input: {
          image: req.file.buffer
        }
      }
    );

    res.json({
      success: true,
      videoUrl: output
    });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Video generation failed",
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
