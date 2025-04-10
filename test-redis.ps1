# Start Redis container
Write-Host "Starting Redis container..."
docker-compose -f docker-compose.redis.yml up -d redis

# Wait for Redis to start
Write-Host "Waiting for Redis to start..."
Start-Sleep -Seconds 5

# Run Redis tests
Write-Host "Running Redis tests..."
npm run test:integration -- --testMatch='**/tests/integration/redis-statistics.test.ts'

# Stop Redis container
Write-Host "Stopping Redis container..."
docker-compose -f docker-compose.redis.yml down
