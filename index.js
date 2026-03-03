const express = require("express");
const multer = require("multer");
const cors = require("cors");
const Replicate = require("replicate");

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Replicate setup
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// 🔒 Prevent multiple simultaneous generations
let isGenerating = false;

app.get("/", (req, res) => {
  res.send("AI Video Server Running with Seedance 🚀");
});

app.post("/upload", upload.single("image"), async (req, res) => {

  if (isGenerating) {
    return res.status(429).json({
      error: "Another video is generating. Please wait..."
    });
  }

  try {
    isGenerating = true;

    if (!req.file) {
      isGenerating = false;
      return res.status(400).json({ error: "No image uploaded" });
    }

    console.log("Generating video using Seedance 1 Lite...");

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          input_image: base64Image
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
      error: error.message
    });
  } finally {
    isGenerating = false;
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
