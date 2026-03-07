require("dotenv").config()

const express = require("express")
const cors = require("cors")
const axios = require("axios")

const app = express()

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 5000

// Health check
app.get("/", (req,res)=>{

res.json({
status:"AI Video Server Running"
})

})


// Generate AI Video
app.post("/generate-video", async (req,res)=>{

try{

const imageUrl = req.body.image

if(!imageUrl){

return res.status(400).json({
error:"Image URL missing"
})

}

console.log("Image URL:", imageUrl)


// Replicate Seedance Model
const response = await axios.post(

"https://api.replicate.com/v1/predictions",

{
version:"seedance_model_version_id",
input:{
image:imageUrl
}
},

{
headers:{
Authorization:`Token ${process.env.REPLICATE_API_TOKEN}`,
"Content-Type":"application/json"
}
}

)

const prediction = response.data

res.json({

status:"processing",
id: prediction.id

})

}
catch(e){

console.log(e.message)

res.status(500).json({
error:"Video generation failed"
})

}

})


// Check status
app.get("/status/:id", async (req,res)=>{

try{

const id = req.params.id

const response = await axios.get(

`https://api.replicate.com/v1/predictions/${id}`,

{
headers:{
Authorization:`Token ${process.env.REPLICATE_API_TOKEN}`
}
}

)

res.json(response.data)

}
catch(e){

res.status(500).json({error:"Status check failed"})

}

})

app.listen(PORT,()=>{

console.log("🚀 AI Video Server Running on port",PORT)

})