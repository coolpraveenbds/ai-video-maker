const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Replicate = require("replicate");

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Replicate with explicit auth
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads folder if not exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `input-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// Health check route
app.get("/", (req, res) => {
  res.send("✅ AI Video Server is running");
});

// Main Upload Route
app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  console.log("📸 Image received:", req.file.filename);

  try {
    // Convert image to base64 Data URI
    const imageBuffer = await fs.promises.readFile(req.file.path);
    const imageBase64 = imageBuffer.toString("base64");
    const imageDataUri = `data:${req.file.mimetype};base64,${imageBase64}`;

    console.log("🚀 Sending to Replicate...");

    // Input for seedance model
    const input = {
      prompt: "Animate this image with smooth natural motion",
      image: imageDataUri,  // This matches model schema
    };

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      { input }
    );

    console.log("✅ Video generated:", output);

    // Get video URL
    const videoUrl = typeof output === "string" ? output : output.url();

    res.json({
      message: "Video generated successfully",
      videoUrl: videoUrl,
    });

  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      message: "Video generation failed",
      error: error.message,
    });
  } finally {
    // Cleanup uploaded image
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
