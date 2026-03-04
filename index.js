import express from "express"
import cors from "cors"
import multer from "multer"
import Replicate from "replicate"
import rateLimit from "express-rate-limit"

const app = express()
app.use(cors())

const upload = multer({ dest: "uploads/" })

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
})

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10
})

app.use(limiter)

app.post("/generate", upload.single("image"), async (req, res) => {

  try {

    const output = await replicate.run(
      "bytedance/seedance-1-lite",
      {
        input: {
          prompt: "cinematic movement",
          duration: 5,
          fps: 24
        }
      }
    )

    res.json({
      video: output
    })

  } catch (error) {

    res.status(500).json({
      error: error.message
    })

  }

})

app.listen(3000, () => {
  console.log("Server running")
})
