import express from "express"
import multer from "multer"
import Replicate from "replicate"
import cloudinary from "cloudinary"
import fs from "fs"

const app = express()

/* =========================
   Multer Image Upload
========================= */

const upload = multer({
  dest: "uploads/"
})

/* =========================
   Replicate API
========================= */

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

/* =========================
   Cloudinary Config
========================= */

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

/* =========================
   Root Route
========================= */

app.get("/", (req, res) => {

  res.send("AI Video Maker Backend Running")

})

/* =========================
   Generate Video Route
========================= */

app.post("/generate", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400).json({
        error: "No image uploaded"
      })

    }

    console.log("Uploading image to Cloudinary...")

    /* Cloudinary Upload */

    const uploadResult = await cloudinary.v2.uploader.upload(
      req.file.path,
      {
        resource_type: "image"
      }
    )

    const imageUrl = uploadResult.secure_url

    console.log("Image URL:", imageUrl)

    /* Delete temp file */

    fs.unlinkSync(req.file.path)

    console.log("Generating video with Seedance AI...")

    /* Replicate Seedance Model */

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          image: imageUrl
        }
      }
    )

    console.log("Video Output:", output)

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

/* =========================
   Server Start
========================= */

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {

  console.log("Server running on port", PORT)

})
