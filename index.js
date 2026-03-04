const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const Replicate = require("replicate");
const rateLimit = require("express-rate-limit");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

/* ---------------- RATE LIMIT ---------------- */

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5
});

app.use("/upload", limiter);

/* ---------------- REPLICATE ---------------- */

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

/* ---------------- STORAGE ---------------- */

const upload = multer({ storage: multer.memoryStorage() });

/* ---------------- QUEUE ---------------- */

let queue = [];
let processing = false;

async function processQueue() {

  if (processing || queue.length === 0) return;

  processing = true;

  const job = queue.shift();

  try {

    const base64Image =
      `data:${job.file.mimetype};base64,${job.file.buffer.toString("base64")}`;

    /* ----------- ADULT FILTER ----------- */

    const nsfw = await replicate.run(
      "salesforce/blip-image-captioning-base",
      {
        input: { image: base64Image }
      }
    );

    const banned = ["nude","sex","porn","xxx"];

    if (banned.some(w => nsfw.toString().toLowerCase().includes(w))) {
      job.res.status(400).json({ error:"Adult content blocked" });
      processing = false;
      processQueue();
      return;
    }

    /* -------- VIDEO GENERATION -------- */

    const output = await replicate.run(
      "bytedance/seedance-1.0",
      {
        input: {
          image: base64Image,
          prompt: "cinematic motion",
          duration: 5,
          fps: 24,
          resolution: "720p",
          aspect_ratio: "16:9"
        }
      }
    );

    let videoUrl = output;

    /* -------- WATERMARK (FREE USERS) -------- */

    if (job.watermark === "true") {

      const tempInput = path.join(__dirname,"input.mp4");
      const tempOutput = path.join(__dirname,"output.mp4");

      const https = require("https");
      const file = fs.createWriteStream(tempInput);

      await new Promise(resolve=>{
        https.get(videoUrl,res=>{
          res.pipe(file);
          file.on("finish",resolve);
        });
      });

      const cmd = `ffmpeg -i ${tempInput} -vf "drawtext=text='AI Video Maker':x=10:y=10:fontsize=28:fontcolor=white" ${tempOutput}`;

      await new Promise((resolve,reject)=>{
        exec(cmd,(err)=>{
          if(err) reject(err);
          else resolve();
        });
      });

      videoUrl = `${job.req.protocol}://${job.req.get("host")}/video`;

      app.get("/video",(req,res)=>{
        res.sendFile(tempOutput);
      });

    }

    job.res.json({
      success:true,
      videoUrl:videoUrl
    });

  } catch(e) {

    job.res.status(500).json({ error:e.message });

  }

  processing = false;

  processQueue();
}

/* ---------------- API ---------------- */

app.post("/upload", upload.single("image"), (req,res)=>{

  if(!req.file){
    return res.status(400).json({ error:"No image uploaded" });
  }

  queue.push({
    file:req.file,
    res:res,
    req:req,
    watermark:req.body.watermark
  });

  processQueue();
});

/* ---------------- SERVER ---------------- */

app.get("/",(req,res)=>{
  res.send("AI Video Server Running");
});

app.listen(PORT,()=>{
  console.log("Server running on port "+PORT);
});