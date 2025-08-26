# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code (will be mounted as volume in dev)
COPY . .

# Expose Vite dev server port (default is 5173)
EXPOSE 5173

# Run Vite dev server (assumes "dev" script in package.json)
CMD ["npm", "run", "dev"]