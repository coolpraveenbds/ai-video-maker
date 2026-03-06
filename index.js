import express from "express"
import multer from "multer"
import cors from "cors"
import Replicate from "replicate"
import dotenv from "dotenv"
import fs from "fs"
import cloudinary from "cloudinary"

dotenv.config()

const app = express()
const upload = multer({ dest: "uploads/" })

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 10000

// Replicate API
const replicate = new Replicate({
 auth: process.env.REPLICATE_API_TOKEN
})

// Cloudinary setup
cloudinary.v2.config({
 cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
 api_key: process.env.CLOUDINARY_API_KEY,
 api_secret: process.env.CLOUDINARY_API_SECRET
})

// Server test
app.get("/", (req, res) => {
 res.send("AI Video Maker Server Running 🚀")
})

// Generate video
app.post("/generate", upload.single("image"), async (req, res) => {

 try {

  if (!req.file) {
   return res.status(400).json({ error: "No image uploaded" })
  }

  console.log("Image received")

  const imageBuffer = fs.readFileSync(req.file.path)

  const base64Image =
   "data:" + req.file.mimetype + ";base64," + imageBuffer.toString("base64")

  console.log("Generating AI Video...")

  const output = await replicate.run(
   "minimax/video-01",
   {
    input: {
     prompt: "portrait cinematic motion",
     image: base64Image
    }
   }
  )

  const videoUrl = Array.isArray(output) ? output[0] : output

  console.log("Video generated:", videoUrl)

  // Upload video to Cloudinary
  const uploadResult = await cloudinary.v2.uploader.upload(videoUrl, {
   resource_type: "video",
   public_id: "ai_video_" + Date.now()
  })

  const finalVideo = uploadResult.secure_url

  console.log("Cloudinary video:", finalVideo)

  fs.unlinkSync(req.file.path)

  res.json({
   video: finalVideo
  })

 } catch (error) {

  console.log("Server error:", error.message)

  res.status(500).json({
   error: error.message
  })

 }

})

app.listen(PORT, () => {
 console.log("Server running on port " + PORT)
})