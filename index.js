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
// Ensure REPLICATE_API_TOKEN is set in your Render Environment Variables
const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
});

// --- Middleware & Directory Setup ---
app.use(cors());
app.use(express.json());

const folders = ['uploads', 'watermarked'];
folders.forEach(f => {
    if (!fs.existsSync(f)) fs.mkdirSync(f);
});

// Serve the watermarked videos folder publicly
app.use('/videos', express.static(path.join(__dirname, 'watermarked')));

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
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
        
        // 1. Convert image to Data URI for Replicate
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

        // 3. Generate Video using Seedance 1.0
        console.log("🎬 Generating AI Video (Seedance 1.0)...");
        
        // This is the stable identifier for Seedance 1.0 on Replicate
        const modelIdentifier = "bytedance/seedance-1.0:7372274223363364451950346399432616894982";

        const videoUrl = await replicate.run(
            modelIdentifier,
            { input: { input_image: imageDataUri } }
        );

        console.log("✅ AI Video Generated:", videoUrl);

        // 4. Handle Premium vs Free
        if (!addWatermark) {
            console.log("✨ Premium User: Returning original video URL.");
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            return res.json({ videoUrl: videoUrl });
        }

        // 5. Apply Watermark for Free Users
        console.log("💧 Free User: Downloading and applying watermark...");
        const tempVideoFile = `uploads/temp_${Date.now()}.mp4`;
        const outputFileName = `vid_${Date.now()}.mp4`;
        const finalOutputPath = `watermarked/${outputFileName}`;

        await downloadFile(videoUrl, tempVideoFile);

        const watermarkText = "AI Video Maker";
        // FFmpeg command to place text in bottom right
        const ffmpegCmd = `ffmpeg -i ${tempVideoFile} -vf "drawtext=text='${watermarkText}':x=W-tw-20:y=H-th-20:fontsize=24:fontcolor=white@0.5" -c:a copy ${finalOutputPath}`;

        exec(ffmpegCmd, (err) => {
            // Cleanup temp files
            if (fs.existsSync(tempVideoFile)) fs.unlinkSync(tempVideoFile);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

            if (err) {
                console.error("❌ FFmpeg Error:", err);
                return res.status(500).send("Watermark processing failed.");
            }

            // Construct public URL for the watermarked video
            const protocol = req.get('x-forwarded-proto') || 'http';
            const host = req.get('host');
            const publicUrl = `${protocol}://${host}/videos/${outputFileName}`;
            
            console.log("🚀 Watermarked video ready:", publicUrl);
            res.json({ videoUrl: publicUrl });
        });

    } catch (error) {
        console.error("❌ Server Error:", error);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        res.status(500).json({ error: error.message });
    }
});

// Helper: Download file from Replicate to local storage
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
