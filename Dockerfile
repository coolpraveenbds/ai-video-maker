# Use a Node base image
FROM node:18-slim

# Install ffmpeg and other system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your server code (including index.js)
COPY . .

# Expose the port your server runs on
EXPOSE 3000

# Start the application
CMD ["node", "index.js"]
