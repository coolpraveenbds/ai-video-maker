import express from "express"
import multer from "multer"
import cors from "cors"
import Replicate from "replicate"
import dotenv from "dotenv"
import fs from "fs"

dotenv.config()

const app = express()
const upload = multer({ dest: "uploads/" })

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 10000

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

app.get("/", (req, res) => {
  res.send("AI Video Maker Server Running 🚀")
})

app.post("/generate", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" })
    }

    console.log("Image received")

    const imageBuffer = fs.readFileSync(req.file.path)

    const base64Image =
      "data:" + req.file.mimetype + ";base64," + imageBuffer.toString("base64")

    console.log("Starting AI generation")

    const prediction = await replicate.predictions.create({
      model: "minimax/video-01",
      input: {
        prompt: "portrait cinematic motion",
        image: base64Image
      }
    })

    let result = prediction

    while (result.status !== "succeeded" && result.status !== "failed") {

      await new Promise(resolve => setTimeout(resolve, 3000))

      result = await replicate.predictions.get(result.id)

      console.log("Status:", result.status)

    }

    if (result.status === "failed") {

      console.log("AI generation failed")

      return res.status(500).json({
        error: "Video generation failed"
      })

    }

    const videoUrl = result.output[0]

    console.log("Video generated:", videoUrl)

    fs.unlinkSync(req.file.path)

    res.json({
      video: videoUrl
    })

  } catch (error) {

    console.log("Server error:", error)

    res.status(500).json({
      error: "Server error"
    })

  }

})

app.listen(PORT, () => {

  console.log("Server running on port " + PORT)

})