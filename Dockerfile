FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

EXPOSE 10000

CMD ["node","index.js"]
