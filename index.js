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

// Initialize Replicate with your API Token
// Ensure REPLICATE_API_TOKEN is set in your Environment Variables on Render
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// --- Middleware & Folders ---
app.use(cors());
app.use(express.json());

// Create necessary directories
const folders = ['uploads', 'watermarked'];
folders.forEach(f => {
    if (!fs.existsSync(f)) fs.mkdirSync(f);
});

// Serve watermarked videos publicly
app.use('/videos', express.static(path.join(__dirname, 'watermarked')));

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `img-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage: storage });

// --- Endpoints ---

app.get('/', (req, res) => {
    res.send("AI Video Maker Server is Live 🚀");
});

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
        const safetyOutput = await replicate.run(
            "replicate/safety-checker:e5d171ccca2161d2e2c948678ffae63cc2e240c9a69ef9a7f7293f39c110bc5e",
            { input: { image: imageDataUri } }
        );

        if (safetyOutput.nsfw_detected) {
            console.log("🚫 Adult content detected! Blocking request.");
            fs.unlinkSync(imagePath);
            return res.status(403).json({ error: "Banned: Inappropriate content detected." });
        }

        // 3. Generate Video using Bytedance Seedance 1.0
        console.log("🎬 Generating AI Video (Bytedance Seedance 1.0)...");
        const videoUrl = await replicate.run(
            "bytedance/seedance-1.0:7372274223363364451950346399432616894982",
            { input: { input_image: imageDataUri } }
        );

        // 4. Handle Premium vs Free (Watermarking)
        if (!addWatermark) {
            console.log("✨ Premium User: Sending direct link.");
            fs.unlinkSync(imagePath);
            return res.json({ videoUrl: videoUrl });
        }

        console.log("💧 Free User: Applying Watermark...");
        const tempVideo = `uploads/temp_${Date.now()}.mp4`;
        const outputName = `vid_${Date.now()}.mp4`;
        const finalPath = `watermarked/${outputName}`;

        // Download video from Replicate to local server for watermarking
        await downloadFile(videoUrl, tempVideo);

        // Apply watermark using FFmpeg
        const watermarkText = "AI Video Maker - FREE";
        const ffmpegCmd = `ffmpeg -i ${tempVideo} -vf "drawtext=text='${watermarkText}':x=W-tw-20:y=H-th-20:fontsize=28:fontcolor=white@0.6" -c:a copy ${finalPath}`;

        exec(ffmpegCmd, (err) => {
            // Cleanup temp files
            if (fs.existsSync(tempVideo)) fs.unlinkSync(tempVideo);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

            if (err) {
                console.error("FFmpeg Error:", err);
                return res.status(500).send("Watermark processing failed.");
            }

            const publicUrl = `https://${req.get('host')}/videos/${outputName}`;
            console.log("✅ Video ready:", publicUrl);
            res.json({ videoUrl: publicUrl });
        });

    } catch (error) {
        console.error("Server Error:", error);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Download file from URL
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err.message));
        });
    });
}

app.listen(PORT, () => console.log(`🚀 AI Server running on port ${PORT}`));


