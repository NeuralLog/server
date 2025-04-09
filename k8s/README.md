# NeuralLog Kubernetes Deployment

This directory contains Kubernetes configuration files for deploying NeuralLog server with different storage backends.

## Storage Options

The NeuralLog server supports three storage backends, which can be configured using the `STORAGE_TYPE` environment variable:

- **Redis Storage** (`STORAGE_TYPE=redis`): Uses Redis as the storage backend (recommended for production)
- **NeDB Storage** (`STORAGE_TYPE=nedb`): Uses NeDB (file-based) as the storage backend
- **Memory Storage** (`STORAGE_TYPE=memory`): Uses in-memory storage (data is lost when the pod restarts)

## Prerequisites

- Kubernetes cluster
- kubectl configured to communicate with your cluster
- Optional: Ingress controller (for the ingress configuration)

## Deployment

### 1. Build and push the Docker image

```bash
# From the server directory
docker build -t neurallog/server:latest .
docker push neurallog/server:latest  # Replace with your image repository
```

### 2. Update the image repository

Edit the server-deployment.yaml file to use your image repository.

### 3. Configure the storage type

Edit the configmap.yaml file to set the desired storage type:

```yaml
STORAGE_TYPE: "redis"   # Options: "redis", "nedb", or "memory"
```

### 4. Deploy using kustomize

```bash
kubectl apply -k .
```

### 5. Access the service

The service is exposed through the Ingress on the following host:

- http://neurallog.local

Update your hosts file or DNS configuration to point this domain to your Ingress controller's IP address.

## Configuration

### Environment Variables

The following environment variables can be configured in the ConfigMap:

- `NODE_ENV`: Node.js environment (default: production)
- `PORT`: Port the server listens on (default: 3030)
- `DEFAULT_NAMESPACE`: Default namespace for storage (default: default)
- `STORAGE_TYPE`: Storage backend to use (options: redis, nedb, memory)
- `REDIS_HOST`: Redis host (default: neurallog-redis, only used when STORAGE_TYPE=redis)
- `REDIS_PORT`: Redis port (default: 6379, only used when STORAGE_TYPE=redis)

Sensitive information should be configured in the Secret:

- `REDIS_PASSWORD`: Redis password (optional, only used when STORAGE_TYPE=redis)

## Scaling

The Redis storage backend is the most suitable for scaling, as it allows multiple instances of the server to share the same data store. The NeDB and Memory storage backends are not suitable for scaling beyond a single replica.

## Persistence

- Server data (for NeDB storage) is stored in a PersistentVolumeClaim
- Redis data is stored in a separate PersistentVolumeClaim
- Memory data is not persistent and will be lost when the pod restarts
