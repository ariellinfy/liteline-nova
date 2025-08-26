# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code (will be mounted as volume in dev)
COPY . .

# Expose backend port (adjust if your app uses a different port, e.g., 3000)
EXPOSE 8001

# Run in dev mode (assumes your package.json has a "dev" script with hot reloading)
CMD ["npm", "run", "dev"]