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

// Initialize Replicate
// Ensure REPLICATE_API_TOKEN is added to your Render Environment Variables
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
// Serve the watermarked videos folder publicly
app.use('/videos', express.static(WATERMARKED_DIR));

// Configure Multer for image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `input-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

// --- Endpoints ---

app.get('/', (req, res) => res.send("AI Video Maker Server is Live 🚀"));

app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send("No image provided.");

    const addWatermark = req.body.add_watermark === 'true';
    const imagePath = req.file.path;

    try {
        console.log("🛠 Processing request...");
        
        // 1. Convert image to Data URI for AI Processing
        const imageBuffer = await fs.promises.readFile(imagePath);
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

        // 2. Strong Adult Content Filter (NSFW Check)
        console.log("🔍 Running AI Safety Filter...");
        const safetyCheck = await replicate.run(
            "replicate/safety-checker:e5d171ccca2161d2e2c948678ffae63cc2e240c9a69ef9a7f7293f39c110bc5e",
            { input: { image: imageDataUri } }
        );

        if (safetyCheck.nsfw_detected) {
            console.log("🚫 Adult content detected! Blocking request.");
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            return res.status(403).json({ error: "Banned: Inappropriate content detected." });
        }

        // 3. Generate Video using Bytedance Seedance 1.0
        console.log("🎬 Generating AI Video (Bytedance Seedance 1.0)...");
        
        const output = await replicate.run(
            "bytedance/seedance-1.0",
            { 
                input: { 
                    input_image: imageDataUri 
                } 
            }
        );

        // Replicate sometimes returns an array of URLs
        const videoUrl = Array.isArray(output) ? output[0] : output;
        console.log("✅ AI Video Generated:", videoUrl);

        // 4. Handle Premium vs Free (No Watermark for Premium)
        if (!addWatermark) {
            console.log("✨ Premium User: Returning direct link.");
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            return res.json({ videoUrl: videoUrl });
        }

        // 5. Apply Watermark for Free Users
        console.log("💧 Free User: Applying Watermark...");
        const tempVideoFile = path.join(UPLOADS_DIR, `temp_${Date.now()}.mp4`);
        const outputName = `vid_${Date.now()}.mp4`;
        const finalPath = path.join(WATERMARKED_DIR, outputName);

        // Download video from Replicate to apply watermark locally
        await downloadFile(videoUrl, tempVideoFile);

        const watermarkText = "AI Video Maker";
        // FFmpeg command to add text watermark at bottom center
        const ffmpegCmd = `ffmpeg -i "${tempVideoFile}" -vf "drawtext=text='${watermarkText}':x=(w-text_w)/2:y=H-th-20:fontsize=24:fontcolor=white@0.5" -c:a copy "${finalPath}"`;

        exec(ffmpegCmd, (err) => {
            // Cleanup temp files
            if (fs.existsSync(tempVideoFile)) fs.unlinkSync(tempVideoFile);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

            if (err) {
                console.error("❌ FFmpeg Error:", err);
                return res.status(500).send("Watermark processing failed.");
            }

            const publicUrl = `https://${req.get('host')}/videos/${outputName}`;
            console.log("🚀 Watermarked video ready:", publicUrl);
            res.json({ videoUrl: publicUrl });
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Download file from URL
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download: ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AI Server active on port ${PORT}`);
});