const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const https = require('https');
const Replicate = require('replicate');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Replicate
// Make sure REPLICATE_API_TOKEN is set in your Render environment variables
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// --- Setup Folders ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const WATERMARKED_DIR = path.join(__dirname, 'watermarked');

[UPLOADS_DIR, WATERMARKED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- Middleware ---
app.use(cors());
app.use(express.json());
// Serve watermarked videos publicly
app.use('/videos', express.static(WATERMARKED_DIR));

// Configure Multer for image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `input-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

// --- Endpoints ---

app.get('/', (req, res) => {
    res.send("AI Video Maker Backend is Running 🚀");
});

app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).send("No image file uploaded.");

    const addWatermark = req.body.add_watermark === 'true';
    const imagePath = req.file.path;

    try {
        console.log("🛠 Processing request...");
        
        // 1. Convert image to Data URI for AI Processing
        const imageBuffer = await fs.promises.readFile(imagePath);
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBuffer.toString("base64")}`;

        // 2. Strong Adult Content Filter (NSFW Check)
        console.log("🔍 Checking for inappropriate content...");
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
        console.log("🎬 Generating AI Video (Seedance 1.0)...");
        
        // Using the base model name to avoid version hash errors
        const videoUrl = await replicate.run(
            "bytedance/seedance-1.0",
            { input: { input_image: imageDataUri } }
        );

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
        const outputFileName = `vid_${Date.now()}.mp4`;
        const finalOutputPath = path.join(WATERMARKED_DIR, outputFileName);

        await downloadFile(videoUrl, tempVideoFile);

        const watermarkText = "AI Video Maker";
        // FFmpeg command to add text watermark at bottom center
        const ffmpegCmd = `ffmpeg -i "${tempVideoFile}" -vf "drawtext=text='${watermarkText}':x=(w-text_w)/2:y=H-th-20:fontsize=24:fontcolor=white@0.5" -c:a copy "${finalOutputPath}"`;

        exec(ffmpegCmd, (err) => {
            // Cleanup temp files
            if (fs.existsSync(tempVideoFile)) fs.unlinkSync(tempVideoFile);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

            if (err) {
                console.error("❌ FFmpeg Error:", err);
                return res.status(500).send("Watermark processing failed.");
            }

            const publicUrl = `https://${req.get('host')}/videos/${outputFileName}`;
            console.log("🚀 Watermarked video ready:", publicUrl);
            res.json({ videoUrl: publicUrl });
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Download file from Replicate
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

app.listen(PORT, () => {
    console.log(`🚀 AI Server active on port ${PORT}`);
});
