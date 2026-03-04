import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import https from 'https';
import Replicate from 'replicate';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// --- Folder Setup ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const WATERMARKED_DIR = path.join(__dirname, 'watermarked');

[UPLOADS_DIR, WATERMARKED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use('/videos', express.static(WATERMARKED_DIR));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `input-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

app.get('/', (req, res) => res.send("AI Video Maker Server is Live 🚀"));

app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send("No image provided.");

    const addWatermark = req.body.add_watermark === 'true';
    const imagePath = req.file.path;

    try {
        console.log("🛠 Reading image...");
        const imageBuffer = await fs.promises.readFile(imagePath);
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

        // 1. Adult Content Filter
        console.log("🔍 Checking AI Safety Filter...");
        const safetyOutput = await replicate.run(
            "replicate/safety-checker:e5d171ccca2161d2e2c948678ffae63cc2e240c9a69ef9a7f7293f39c110bc5e",
            { input: { image: imageDataUri } }
        );

        if (safetyOutput.nsfw_detected) {
            console.log("🚫 Adult content detected! Blocking.");
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            return res.status(403).json({ error: "Banned: Inappropriate content detected." });
        }

        // 2. Generate Video using Seedance 1-Lite
        console.log("🎬 Generating Video (bytedance/seedance-1-lite)...");
        
        const output = await replicate.run(
            "bytedance/seedance-1-lite",
            { 
                input: { 
                    image: imageDataUri,
                    prompt: "natural movement, cinematic quality, high resolution"
                } 
            }
        );

        const videoUrl = Array.isArray(output) ? output[0] : output;
        console.log("✅ AI Video URL:", videoUrl);

        if (!addWatermark) {
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            return res.json({ videoUrl: videoUrl });
        }

        // 3. Apply Watermark for Free Users
        console.log("💧 Applying Watermark...");
        const tempVideo = path.join(UPLOADS_DIR, `temp_${Date.now()}.mp4`);
        const outputName = `vid_${Date.now()}.mp4`;
        const finalPath = path.join(WATERMARKED_DIR, outputName);

        await downloadFile(videoUrl, tempVideo);

        const watermarkText = "AI Video Maker";
        const cmd = `ffmpeg -i "${tempVideo}" -vf "drawtext=text='${watermarkText}':x=(w-text_w)/2:y=H-th-20:fontsize=24:fontcolor=white@0.5" -c:a copy "${finalPath}"`;

        exec(cmd, (err) => {
            if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

            if (err) {
                console.error("FFmpeg Error:", err);
                return res.status(500).send("Watermark failed.");
            }

            const publicUrl = `https://${req.get('host')}/videos/${outputName}`;
            res.json({ videoUrl: publicUrl });
        });

    } catch (error) {
        console.error("Server Error:", error);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: error.message });
    }
});

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));