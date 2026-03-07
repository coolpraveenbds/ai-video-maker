# Use Node.js LTS image
FROM node:18

# App directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]

