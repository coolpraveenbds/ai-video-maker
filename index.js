import express from "express"
import multer from "multer"
import cors from "cors"
import Replicate from "replicate"

const app = express()

app.use(cors())
app.use(express.json())

app.set("trust proxy", 1)

const upload = multer({ dest: "uploads/" })

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

app.get("/", (req, res) => {
  res.send("AI Video Maker Backend Running")
})

app.post("/generate", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        error: "No image uploaded"
      })
    }

    const prompt = req.body.prompt || "cinematic camera movement"

    const imageUrl =
      "https://replicate.delivery/pbxt/sample.jpg"

    console.log("Generating video...")

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          image: imageUrl,
          prompt: prompt
        }
      }
    )

    const videoUrl = Array.isArray(output) ? output[0] : output

    console.log("Video generated:", videoUrl)

    res.json({
      status: "success",
      video: videoUrl
    })

  } catch (error) {

    console.log("Server error:", error)

    res.status(500).json({
      error: error.message
    })

  }

})

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log("Server running on port " + PORT)
})
