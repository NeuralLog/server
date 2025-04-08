# NeuralLog Server

This is the server component of the NeuralLog system. It provides a RESTful API for storing and retrieving logs.

## Features

- RESTful API for log management
- Support for multiple storage adapters (Memory, NeDB)
- Persistent storage with Docker volumes
- Comprehensive search capabilities

## API Endpoints

- `GET /logs`: Get all log names
- `GET /logs/:logName`: Get entries for a specific log
- `POST /logs/:logName`: Overwrite a log (clear and add new entries)
- `PATCH /logs/:logName`: Append to a log
- `DELETE /logs/:logName`: Clear a log
- `GET /logs/:logName/:logId`: Get a specific log entry
- `POST /logs/:logName/:logId`: Update a specific log entry
- `DELETE /logs/:logName/:logId`: Delete a specific log entry
- `GET /search`: Search logs with various criteria

## Running with Docker

### Using Docker Compose (Recommended)

Docker Compose provides a simple way to run the server with persistent storage:

```bash
# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

Or use the npm scripts:

```bash
# Start the server
npm run docker:compose:up

# View logs
npm run docker:compose:logs

# Stop the server
npm run docker:compose:down
```

### Using Docker Directly

You can also run the server directly with Docker:

```bash
# Build the Docker image
docker build -t neurallog-server .

# Run the server with a persistent volume
docker run -d -p 3030:3030 -v $(pwd)/data:/app/data --name neurallog-server neurallog-server
```

Or use the npm scripts:

```bash
# Build the Docker image
npm run docker:build

# Run the server with a persistent volume
npm run docker:run
```

### Docker Configuration

The Docker setup includes:

1. **Persistent Storage**: Log data is stored in a Docker volume mounted at `/app/data` in the container
2. **Port Mapping**: The server is exposed on port 3030
3. **Environment Variables**: Configure the server using environment variables in the docker-compose.yml file

### Docker Network

When running both the server and client with Docker, they need to communicate with each other. There are two approaches:

1. **Host Network**: Run the client with `--network host` to access the server on localhost
2. **Docker Network**: Create a Docker network and connect both containers to it

## Environment Variables

- `PORT`: The port the server listens on (default: 3030)
- `NODE_ENV`: The environment mode (default: production)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build TypeScript code
npm run build

# Run unit tests
npm run test

# Run end-to-end tests with Docker
npm run test:e2e

# Lint code
npm run lint
```

## End-to-End Testing

The project includes end-to-end tests that verify the entire system works correctly. These tests:

1. Start the server using Docker Compose
2. Build and run the client with test input
3. Verify the output and functionality
4. Clean up all Docker resources

To run the end-to-end tests:

```bash
npm run test:e2e
```

This requires Docker and Docker Compose to be installed and running.

### Manual End-to-End Testing

#### Testing with Docker (Recommended)

1. Start the server using Docker Compose:
   ```bash
   docker-compose up -d
   ```

2. Test the API directly:
   ```bash
   # Get all logs
   curl http://localhost:3030/logs

   # Append to a log
   curl -X POST http://localhost:3030/logs/test-log -H "Content-Type: application/json" -d '{"message":"Test message","level":"info"}'

   # Get a specific log
   curl http://localhost:3030/logs/test-log
   ```

3. Test with the client Docker container:
   ```bash
   # Go to the client directory
   cd ../client

   # Build the Docker image
   docker build -t neurallog-client .

   # Test the get_logs tool
   echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_logs","arguments":{}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client

   # Test appending to a log
   echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"append_to_log","arguments":{"log_name":"test-log","data":{"message":"Test message","level":"info"}}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client

   # Test retrieving a log
   echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_log_by_name","arguments":{"log_name":"test-log"}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client
   ```

#### Complete End-to-End Test Workflow

Here's a complete workflow for testing both components with Docker:

```bash
# 1. Start the server
cd server
docker-compose up -d

# 2. Build the client
cd ../client
docker build -t neurallog-client .

# 3. Test the workflow

# First, check that there are no logs
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_logs","arguments":{}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client

# Create a log with a JSON object
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"append_to_log","arguments":{"log_name":"test-object","data":{"message":"Test message","level":"info"}}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client

# Create a log with a primitive value (properly wrapped)
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"append_to_log","arguments":{"log_name":"test-primitive","data":{"data":"This is a test string"}}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client

# Retrieve the logs
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_logs","arguments":{}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client

# Search for logs containing "Test"
echo '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"search","arguments":{"query":"Test"}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client

# Clean up
echo '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"clear_log","arguments":{"log_name":"test-object"}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client
echo '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"clear_log","arguments":{"log_name":"test-primitive"}}}' | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 neurallog-client
```

## Data Handling

The server handles JSON data in the following ways:

1. **JSON Objects**: JSON objects are stored as-is in the database.

2. **Primitive Values**: Primitive values (strings, numbers, etc.) are automatically wrapped in a JSON object with a `data` field:
   ```json
   {"data": "This is a test string"}
   ```

3. **JSON-like Strings**: Strings that look like JSON but aren't valid JSON are treated as regular strings and wrapped in a `data` field.

This ensures that all data is stored as JSON objects in a consistent format, making it easier to work with the data programmatically.

## License

MIT
