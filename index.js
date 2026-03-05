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

// --- Cloudinary Config ---
cloudinary.config({ 
  cloud_name: 'dwan6rapc', 
  api_key: '496517261156243', 
  api_secret: 'NgLu4QK2J-nt8kBIeo14eA_aApI' 
});

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/generate', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send("No image.");

    try {
        const imageBuffer = await fs.promises.readFile(req.file.path);
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

        // 1. Adult Content Filter
        const safety = await replicate.run("replicate/safety-checker:e5d171ccca2161d2e2c948678ffae63cc2e240c9a69ef9a7f7293f39c110bc5e", { input: { image: imageDataUri } });
        if (safety.nsfw_detected) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: "Inappropriate content detected." });
        }

        // 2. Generate Video
        const output = await replicate.run("bytedance/seedance-1.0", { input: { input_image: imageDataUri } });
        const rawVideoUrl = Array.isArray(output) ? output[0] : output;

        // 3. Upload to Cloudinary (Applying Watermark if needed)
        // Note: For real watermarking on Cloudinary, you use 'transformation'
        const uploadResponse = await cloudinary.uploader.upload(rawVideoUrl, {
            resource_type: "video",
            transformation: [
                { overlay: { font_family: "Arial", font_size: 30, text: "AI Video Maker" }, gravity: "south_east", y: 20, x: 20, color: "white", opacity: 50 }
            ]
        });

        fs.unlinkSync(req.file.path);
        res.json({ video: uploadResponse.secure_url });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => console.log("Server Live 🚀"));