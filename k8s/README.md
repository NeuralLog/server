# NeuralLog Kubernetes Deployment

This directory contains Kubernetes configuration files for deploying NeuralLog server with different storage backends.

## Available Deployments

- **Redis Storage**: Uses Redis as the storage backend
- **NeDB Storage**: Uses NeDB (file-based) as the storage backend
- **Memory Storage**: Uses in-memory storage (data is lost when the pod restarts)

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

Edit the deployment files to use your image repository:

- server-redis-deployment.yaml
- server-nedb-deployment.yaml
- server-memory-deployment.yaml

### 3. Deploy using kustomize

```bash
kubectl apply -k .
```

### 4. Access the services

The services are exposed through the Ingress on the following hosts:

- Redis storage: http://redis.neurallog.local
- NeDB storage: http://nedb.neurallog.local
- Memory storage: http://memory.neurallog.local

Update your hosts file or DNS configuration to point these domains to your Ingress controller's IP address.

## Configuration

### Environment Variables

The following environment variables can be configured in the ConfigMap:

- `NODE_ENV`: Node.js environment (default: production)
- `PORT`: Port the server listens on (default: 3030)
- `DEFAULT_NAMESPACE`: Default namespace for storage (default: default)
- `REDIS_HOST`: Redis host (default: neurallog-redis)
- `REDIS_PORT`: Redis port (default: 6379)

Sensitive information should be configured in the Secret:

- `REDIS_PASSWORD`: Redis password (optional)

## Scaling

The Redis storage backend is the most suitable for scaling, as it allows multiple instances of the server to share the same data store. The NeDB and Memory storage backends are not suitable for scaling beyond a single replica.

## Persistence

- Redis data is stored in a PersistentVolumeClaim
- NeDB data is stored in a PersistentVolumeClaim
- Memory data is not persistent and will be lost when the pod restarts
