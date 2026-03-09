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
        version: "3f0457d0c2a3c0d21c12f1d3a2c5d7f19e6c4db7b3b2d9cfa7a19d8b2f9a7a2e",
        input: {
          image: image_url,
          motion_bucket_id: 127,
          fps: 6
        }
      },
      {
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    let prediction = response.data;

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed"
    ) {

      await new Promise(r => setTimeout(r, 4000));

      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            Authorization: `Token ${process.env.REPLICATE_API_KEY}`
          }
        }
      );

      prediction = poll.data;
    }

    if (prediction.status === "succeeded") {

      return res.json({
        video_url: prediction.output[0]
      });

    } else {

      return res.status(500).json({
        error: "Video generation failed"
      });

    }

  } catch (error) {

    console.error(error.response?.data || error.message);

    res.status(500).json({
      error: "Server error"
    });

  }

});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
