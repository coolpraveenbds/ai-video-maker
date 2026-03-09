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
      return res.status(400).json({ error: "Image URL missing" });
    }

    const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

    if (!REPLICATE_TOKEN) {
      return res.status(500).json({ error: "Replicate API token missing" });
    }

    const createPrediction = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version: "db21e45a987c6c9d3f9e2f98d1c0a12c",
        input: {
          image: image_url
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

        return res.json({
          video_url: poll.data.output
        });

      }

      if (status === "failed") {

        return res.status(500).json({
          error: "Video generation failed"
        });

      }

    }

  } catch (error) {

    console.error(error.response?.data || error.message);

    res.status(500).json({
      error: error.response?.data || "Server error"
    });

  }

});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
