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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

cloudinary.config({ 
  cloud_name: 'dwan6rapc', 
  api_key: '496517261156243', 
  api_secret: 'NgLu4QK2J-mt8kBTeo14eA_aApI' 
});

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => res.send("AI Video Maker Server is Live 🚀"));

app.post('/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send("No image provided.");

    const imagePath = req.file.path;
    const addWatermark = req.body.add_watermark !== 'false'; 

    try {
        console.log("🛠️ Processing image...");
        const imageBuffer = await fs.promises.readFile(imagePath);
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

        // 1. Safety Filter (Specific Version to avoid 404)
        console.log("🔍 Running AI Safety Filter...");
        const safety = await replicate.run(
            "replicate/safety-checker:e5d171ccca2161d2e2c948678ffae63cc2e240c9a69ef9a7f7293f39c110bc5e", 
            { input: { image: imageDataUri } }
        );

        if (safety.nsfw_detected) {
            console.log("🚫 NSFW content detected.");
            fs.unlinkSync(imagePath);
            return res.status(403).json({ error: "Banned: Inappropriate content detected." });
        }

        // 2. Generate Video (Bytedance Seedance 1.0)
        console.log("🎬 Generating AI Video...");
        const output = await replicate.run(
            "bytedance/seedance-1.0:7372274223363364451950346399432616894982", 
            { input: { input_image: imageDataUri } }
        );
        const rawVideoUrl = Array.isArray(output) ? output[0] : output;

        // 3. Upload to Cloudinary with Watermark
        console.log("☁️ Uploading to Cloudinary...");
        const transformations = [{ width: 1280, crop: "scale" }];
        if (addWatermark) {
            transformations.push({ 
                overlay: { font_family: "Arial", font_size: 40, text: "AI VIDEO MAKER" }, 
                gravity: "south_east", y: 30, x: 30, color: "white", opacity: 60 
            });
        }

        const uploadResponse = await cloudinary.uploader.upload(rawVideoUrl, {
            resource_type: "video",
            transformation: transformations
        });

        fs.unlinkSync(imagePath);
        console.log("✅ Video Ready!");
        res.json({ video: uploadResponse.secure_url });

    } catch (error) {
        console.error("❌ Server Error:", error.message);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 AI Server active on port ${PORT}`));