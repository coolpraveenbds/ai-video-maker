# Use Node.js base image
FROM node:18-slim

# Install ffmpeg for the watermark system
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all your code from GitHub into the container
COPY . .

# Troubleshooting: This will print the files in the log so we can see the path
RUN ls -R

# Ensure folders for uploads and watermarks exist
RUN mkdir -p uploads watermarked

# Expose the port
EXPOSE 3000

# Start the server using the file in the root
CMD ["node", "index.js"]
