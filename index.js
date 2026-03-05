import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import Replicate from 'replicate';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const app = express();
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// --- Cloudinary Configuration ---
// Set these in your Render Dashboard -> Environment tab
cloudinary.config({ 
  cloud_name: process.env.'dwan6rapc', 
  api_key: process.'env496517261156243'., 
  api_secret: process.env.'NgLu4QK2J-nt8kBIeo14eA_aApI' 

});

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send("No image provided.");

    const imagePath = req.file.path;

    try {
        console.log("🛠️ Reading image...");
        const imageBuffer = await fs.promises.readFile(imagePath);
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

        // 1. Strong Adult Content Filter (NSFW Check)
        console.log("🔍 Running Safety Checker...");
        const safety = await replicate.run(
            "replicate/safety-checker:e5d171ccca2161d2e2c948678ffae63cc2e240c9a69ef9a7f7293f39c110bc5e", 
            { input: { image: imageDataUri } }
        );

        if (safety.nsfw_detected) {
            console.log("🚫 NSFW Content Blocked");
            fs.unlinkSync(imagePath);
            return res.status(403).json({ error: "Banned: Inappropriate content detected." });
        }

        // 2. Generate Video using Seedance 1.0
        console.log("🎬 Animating image with Seedance 1.0...");
        const output = await replicate.run(
            "bytedance/seedance-1.0", 
            { input: { input_image: imageDataUri } }
        );
        const rawVideoUrl = Array.isArray(output) ? output[0] : output;

        // 3. Upload to Cloudinary with Watermark Transformation
        console.log("☁️ Saving to Cloudinary...");
        const uploadResponse = await cloudinary.uploader.upload(rawVideoUrl, {
            resource_type: "video",
            transformation: [
                { 
                    overlay: { font_family: "Arial", font_size: 40, text: "AI VIDEO MAKER" }, 
                    gravity: "south_east", y: 30, x: 30, color: "white", opacity: 60 
                }
            ]
        });

        fs.unlinkSync(imagePath);
        console.log("✅ Success!");
        res.json({ video: uploadResponse.secure_url });

    } catch (error) {
        console.error("❌ Error:", error);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server ready on port ${PORT}`));