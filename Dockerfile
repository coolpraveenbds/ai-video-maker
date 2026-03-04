# Use a slim Node.js image to keep it lightweight
FROM node:18-slim

# Install ffmpeg and clean up to keep the image small
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create and set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your server files
COPY . .

# Create folders for uploads and processing
RUN mkdir -p uploads watermarked

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "index.js"]
