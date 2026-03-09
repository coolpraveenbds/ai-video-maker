import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
  res.send("AI Video Server Running");
});

app.post("/generate-video", async (req, res) => {

  try {

    const { image_url } = req.body;

    if (!image_url) {
      return res.status(400).json({
        error: "Image URL missing"
      });
    }

    const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_TOKEN) {
      return res.status(500).json({
        error: "Replicate API token missing"
      });
    }

    // CREATE PREDICTION
    const createPrediction = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version: "83b3c1f8c6d0c59e9c8a3c6d53295d85f1e4b74e6a1fde37d399a8ce28ed5ab2",
        input: {
          image: image_url,
          motion: "zoom"
        }
      },
      {
        headers: {
          Authorization: `Token ${REPLICATE_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const prediction = createPrediction.data;

    let status = prediction.status;
    let id = prediction.id;

    // WAIT FOR RESULT
    while (status !== "succeeded" && status !== "failed") {

      await new Promise(r => setTimeout(r, 4000));

      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${id}`,
        {
          headers: {
            Authorization: `Token ${REPLICATE_TOKEN}`
          }
        }
      );

      status = poll.data.status;

      if (status === "succeeded") {

        const videoUrl = poll.data.output;

        return res.json({
          video_url: videoUrl
        });

      }

      if (status === "failed") {

        return res.status(500).json({
          error: "Video generation failed"
        });

      }

    }

  } catch (error) {

    console.log(error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data || "Server error"
    });

  }

});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});