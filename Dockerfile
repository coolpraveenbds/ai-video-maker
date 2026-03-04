FROM node:18-slim

# Install ffmpeg for watermarking
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
