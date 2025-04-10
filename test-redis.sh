#!/bin/bash

# Start Redis container
echo "Starting Redis container..."
docker-compose -f docker-compose.redis.yml up -d redis

# Wait for Redis to start
echo "Waiting for Redis to start..."
sleep 5

# Run Redis tests
echo "Running Redis tests..."
npm run test:integration -- --testMatch='**/tests/integration/redis-statistics.test.ts'

# Stop Redis container
echo "Stopping Redis container..."
docker-compose -f docker-compose.redis.yml down
