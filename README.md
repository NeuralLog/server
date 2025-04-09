# NeuralLog Server

The central server component of the NeuralLog intelligent logging system. This server provides RESTful APIs for log management and storage, forming the foundation of the NeuralLog ecosystem.

> **Note:** This repository uses `main` as its default branch.

## Overview

NeuralLog is an intelligent logging system with automated action capabilities. It captures log events from various sources, analyzes patterns in those logs, and triggers configurable actions when specific conditions are met. The server component is responsible for:

- Receiving and storing logs from various clients
- Providing APIs for log retrieval and management
- Supporting the storage layer of the NeuralLog architecture
- Enabling integration with the MCP (Model Context Protocol) ecosystem

## Architecture

The NeuralLog server is part of a larger ecosystem as defined in the [NeuralLog specifications](https://github.com/NeuralLog/specs):

```
┌─────────────────────────────────────────────────────────────┐
│                     NeuralLog System                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────────────┐  ┌─────────────┐  │
│  │ NeuralLog   │  │ MCP Server          │  │ NeuralLog   │  │
│  │ Core        │◄─┤                     │◄─┤ MCP Clients │  │
│  │ Services    │  │ • Tool Registry     │  │             │  │
│  │             │  │ • Connection Mgmt   │  │ • TypeScript│  │
│  │ • Logging   │  │ • Authentication    │  │ • Unity     │  │
│  │ • Analysis  │  │ • Transport Layer   │  │ • Python    │  │
│  │ • Actions   │  │ • Request Handling  │  │ • Others    │  │
│  └─────────────┘  └─────────────────────┘  └─────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Features

- RESTful API for log management
- Support for multiple storage adapters (Memory, NeDB, Redis)
- Namespace support for logical isolation of data
- Persistent storage with Docker volumes
- Comprehensive search capabilities
- Integration with MCP clients
- Multi-tenant support through namespaces
- Kubernetes deployment support

## API Endpoints

### Log Management

- `GET /logs`: Get all log names
- `GET /logs/:logName`: Get entries for a specific log
- `POST /logs/:logName`: Overwrite a log (clear and add new entries)
- `PATCH /logs/:logName`: Append to a log
- `DELETE /logs/:logName`: Clear a log
- `GET /logs/:logName/:logId`: Get a specific log entry
- `POST /logs/:logName/:logId`: Update a specific log entry
- `DELETE /logs/:logName/:logId`: Delete a specific log entry

### Search

- `GET /search`: Search logs with various criteria

## Running with Docker

### Using Docker Compose (Recommended)

Docker Compose provides a simple way to run the server with persistent storage. You can choose between different storage adapters:

#### Redis Storage (Recommended for Production)

```bash
# Start the server with Redis storage
docker-compose up -d server-redis redis

# View logs
docker-compose logs -f server-redis redis

# Stop all services
docker-compose down
```

#### NeDB Storage (File-based)

```bash
# Start the server with NeDB storage
docker-compose up -d server-nedb

# View logs
docker-compose logs -f server-nedb

# Stop all services
docker-compose down
```

#### Memory Storage (Ephemeral)

```bash
# Start the server with Memory storage
docker-compose up -d server-memory

# View logs
docker-compose logs -f server-memory

# Stop all services
docker-compose down
```

#### All Storage Types

```bash
# Start all servers (Redis, NeDB, and Memory)
docker-compose up -d

# View all logs
docker-compose logs -f

# Stop all services
docker-compose down
```

#### Using npm Scripts

You can also use the npm scripts:

```bash
# Start the server with Redis storage
npm run docker:compose:up:redis

# Start the server with NeDB storage
npm run docker:compose:up:nedb

# Start the server with Memory storage
npm run docker:compose:up:memory

# Start all servers
npm run docker:compose:up

# View logs for Redis storage
npm run docker:compose:logs:redis

# View logs for NeDB storage
npm run docker:compose:logs:nedb

# View logs for Memory storage
npm run docker:compose:logs:memory

# View all logs
npm run docker:compose:logs

# Stop all services
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

1. **Persistent Storage**: Log data is stored in Docker volumes mounted at `/app/data` in the containers
2. **Port Mapping**:
   - Redis storage server: Port 3030
   - NeDB storage server: Port 3031
   - Memory storage server: Port 3032
   - Redis service: Port 6379
3. **Environment Variables**: Configure the server using environment variables in the docker-compose.yml file

### Docker Network

When running both the server and client with Docker, they need to communicate with each other. There are two approaches:

1. **Host Network**: Run the client with `--network host` to access the server on localhost
2. **Docker Network**: Create a Docker network and connect both containers to it

## Kubernetes Deployment

The NeuralLog server can be deployed to Kubernetes using the provided configuration files in the `k8s` directory.

### Prerequisites

- Kubernetes cluster
- kubectl configured to communicate with your cluster
- Optional: Ingress controller (for the ingress configuration)

### Deployment

```bash
# Apply all Kubernetes configurations
kubectl apply -k k8s

# Or use the npm script
npm run k8s:apply
```

### Available Deployments

The Kubernetes configuration includes deployments for all three storage types:

1. **Redis Storage**: Uses Redis as the storage backend (recommended for production)
2. **NeDB Storage**: Uses NeDB (file-based) as the storage backend
3. **Memory Storage**: Uses in-memory storage (data is lost when the pod restarts)

### Accessing the Services

The services are exposed through the Ingress on the following hosts:

- Redis storage: http://redis.neurallog.local
- NeDB storage: http://nedb.neurallog.local
- Memory storage: http://memory.neurallog.local

Update your hosts file or DNS configuration to point these domains to your Ingress controller's IP address.

### Configuration

The Kubernetes deployment uses ConfigMaps and Secrets for configuration:

- **ConfigMap**: Contains non-sensitive configuration like environment variables
- **Secret**: Contains sensitive information like passwords

See the `k8s/README.md` file for more details on the Kubernetes deployment.

## Environment Variables

- `PORT`: The port the server listens on (default: 3030)
- `NODE_ENV`: The environment mode (default: production)
- `STORAGE_TYPE`: The storage adapter to use ('memory', 'nedb', or 'redis', default: 'memory')
- `DB_PATH`: The path to store NeDB data (default: './data')
- `DEFAULT_NAMESPACE`: The default namespace for storage (default: 'default')
- `REDIS_HOST`: The Redis host (default: 'localhost')
- `REDIS_PORT`: The Redis port (default: 6379)
- `REDIS_PASSWORD`: The Redis password (optional)
- `REDIS_DB`: The Redis database number (default: 0)

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

## Related Repositories

- [NeuralLog Specifications](https://github.com/NeuralLog/specs) - Technical specifications for the NeuralLog system
- [NeuralLog MCP Client](https://github.com/NeuralLog/mcp-client) - Model Context Protocol client for AI integration
- [NeuralLog TypeScript Client](https://github.com/NeuralLog/typescript) - TypeScript client for NeuralLog
- [NeuralLog Unity Client](https://github.com/NeuralLog/unity) - Unity client for NeuralLog

## Future Development

The NeuralLog server is under active development with the following features planned:

- Advanced pattern detection and analysis
- Rule-based action system
- Multi-tenant support with complete isolation
- Enhanced security features
- Scalable architecture for high-volume logging

## License

MIT
