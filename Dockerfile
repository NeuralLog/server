FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN npm run build

# Expose the port the server runs on
EXPOSE 3030

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3030

# Start the server
CMD ["node", "dist/server.js"]
