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

    const response = await axios.post(
      "https://api.replicate.com/v1/predictions",
      {
        version: "seedance-ai/seedance-1.0",
        input: {
          image: image_url
        }
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const prediction = response.data;

    let status = prediction.status;
    let id = prediction.id;

    while (status !== "succeeded" && status !== "failed") {

      await new Promise(r => setTimeout(r, 4000));

      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${id}`,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_KEY}`
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
        return res.status(500).json({ error: "Video generation failed" });
      }

    }

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Server error"
    });

  }

});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});