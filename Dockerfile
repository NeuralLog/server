FROM node:22-alpine

WORKDIR /app

# Set npm registry argument
ARG NPM_REGISTRY=https://registry.npmjs.org

# Set npm registry
RUN npm config set registry $NPM_REGISTRY

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

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
