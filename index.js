const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Replicate = require('replicate');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
// Initialize Replicate client
// It automatically reads the REPLICATE_API_TOKEN from your environment
const replicate = new Replicate();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Create 'uploads' directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer setup for storing uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Use a unique name for the input file
        cb(null, `input-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// --- Server Endpoints ---

// Simple endpoint to check if the server is running
app.get('/', (req, res) => {
    res.send("AI Video Server (with Replicate) is running");
});

/**
 * Main endpoint for video generation.
 * 1. Receives an image from the Android app.
 * 2. Sends the image to Replicate to be animated by the seedance model.
 * 3. Returns the URL of the generated video.
 */
app.post('/upload', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
    }

    console.log("✅ Image received:", req.file.filename);
    console.log("🚀 Starting AI video generation with Replicate...");

    try {
        // Prepare the input image for the Replicate model
        // We convert it to a "data URI" format
        const imagePath = req.file.path;
        const imageFile = await fs.promises.readFile(imagePath);
        const imageBase64 = imageFile.toString("base64");
        const imageDataUri = `data:${req.file.mimetype};base64,${imageBase64}`;

        // The specific model identifier from Replicate
        const modelIdentifier = "seedance/seedance-1.0:7372274223363364451950346399432616894982";

        // Run the Replicate model
        const output = await replicate.run(modelIdentifier, {
            input: {
                // The model expects a public URL or a data URI
                input_image: imageDataUri
            }
        });

        console.log("✅ Replicate finished. Video URL:", output);

        // The output from this model is the direct URL to the video file
        const generatedVideoUrl = output;

        // Send a success response back to the Android app
        res.json({
            message: "Video generated successfully with Replicate",
            videoUrl: generatedVideoUrl
        });

    } catch (error) {
        console.error("❌ Replicate API Error:", error);
        res.status(500).json({ message: "Failed to generate video with Replicate.", error: error.message });
    } finally {
        // Clean up the uploaded image file after we're done with it
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
    }
});


// Start the server
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});