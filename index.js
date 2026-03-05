import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import Replicate from 'replicate';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Replicate
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// --- Cloudinary Configuration ---
// Set these credentials in your Render Dashboard -> Environment tab
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Root endpoint to confirm the server is live
app.get('/', (req, res) => res.send("AI Video Maker Server is Live 🚀"));

// The main endpoint your app calls
app.post('/generate', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No image provided.");
    }

    const imagePath = req.file.path;
    const addWatermark = req.body.add_watermark !== 'false'; // Default to true for safety

    try {
        console.log("🛠️ Processing new request...");
        const imageBuffer = await fs.promises.readFile(imagePath);
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

        // 1. Strong Adult Content Filter (NSFW Check) - using a stable model name
        console.log("🔍 Running AI Safety Filter...");
        const safetyCheck = await replicate.run(
            "replicate/safety-checker", // Corrected: Using the base model name
            { input: { image: imageDataUri } }
        );

        if (safetyCheck.nsfw_detected) {
            console.log("🚫 Adult content detected! Blocking request.");
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            return res.status(403).json({ error: "Banned: Inappropriate content detected." });
        }

        // 2. Generate Video using Bytedance Seedance 1.0
        console.log("🎬 Generating AI Video with Seedance 1.0...");
        const videoOutput = await replicate.run(
            "bytedance/seedance-1.0", 
            { input: { input_image: imageDataUri } }
        );
        const rawVideoUrl = Array.isArray(videoOutput) ? videoOutput[0] : videoOutput;

        // 3. Upload to Cloudinary with Watermark Transformation
        console.log("☁️ Finalizing with Cloudinary...");
        
        const transformations = [];
        if (addWatermark) {
            transformations.push({ 
                overlay: { font_family: "Arial", font_size: 40, text: "AI VIDEO MAKER" }, 
                gravity: "south_east", y: 30, x: 30, color: "white", opacity: 60 
            });
        }

        const uploadResponse = await cloudinary.uploader.upload(rawVideoUrl, {
            resource_type: "video",
            transformation: transformations,
            public_id: `video_${Date.now()}` // Use a unique name
        });

        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        
        console.log("✅ Success! Sending video URL to app.");
        res.json({ video: uploadResponse.secure_url });

    } catch (error) {
        console.error("❌ An error occurred:", error.message);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: "An unexpected error occurred on the server." });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server listening on port ${PORT}`));
