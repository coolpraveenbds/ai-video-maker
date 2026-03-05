import express from "express"
import multer from "multer"
import Replicate from "replicate"
import cloudinary from "cloudinary"

const app = express()

const upload = multer({ dest: "uploads/" })

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

app.get("/", (req, res) => {
  res.send("AI Video Maker Backend Running")
})

app.post("/generate", upload.single("image"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" })
    }

    console.log("Uploading image to Cloudinary")

    const cloudinaryUpload = await cloudinary.v2.uploader.upload(
      req.file.path
    )

    const imageUrl = cloudinaryUpload.secure_url

    console.log("Image URL:", imageUrl)

    console.log("Generating video with Seedance")

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          image: imageUrl
        }
      }
    )

    console.log("Video:", output)

    res.json({
      video: output
    })

  } catch (error) {

    console.log("ERROR:", error)

    res.status(500).json({
      error: "Video generation failed"
    })

  }
})

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})