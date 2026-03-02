const express = require("express");
const multer = require("multer");
const cors = require("cors");
const Replicate = require("replicate");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// ====== MULTER CONFIG ======
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ====== REPLICATE CONFIG ======
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// ====== TEST ROUTE ======
app.get("/", (req, res) => {
  res.send("AI Video Server Running (With NSFW Protection)");
});

// ====== UPLOAD ROUTE ======
app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    console.log("Checking image safety...");

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // Convert image to base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    // ===== NSFW MODERATION =====
    const moderation = await replicate.run(
      "openai/moderation",
      {
        input: {
          input: "Check this image for adult or explicit content"
        }
      }
    );

    if (moderation?.results?.[0]?.category_scores?.sexual > 0.5) {
      return res.status(400).json({
        error: "Adult content detected. Upload blocked.",
      });
    }

    console.log("Generating video...");

    // ===== VIDEO GENERATION MODEL =====
    const output = await replicate.run(
      "lucataco/animate-diff",
      {
        input: {
          image: base64Image,
          prompt: "cinematic motion, smooth animation",
        },
      }
    );

    return res.json({
      success: true,
      video_url: output,
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
});

// ====== START SERVER ======
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
