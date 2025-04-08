#!/bin/bash

# End-to-end test script for AI-MCP-Logger
# This script tests the entire system by:
# 1. Starting the server with Docker Compose
# 2. Running the MCP client with test input
# 3. Verifying the output
# 4. Cleaning up

# Configuration
SERVER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MCP_CLIENT_DIR="$(cd "$SERVER_DIR/../mcp-client" && pwd)"
TEST_LOG_NAME="test-log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TEST_DATA="{\"message\":\"Test message\",\"timestamp\":\"$TIMESTAMP\"}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to clean up resources
cleanup() {
  echo "Cleaning up..."
  cd "$SERVER_DIR" && docker-compose down
  exit ${1:-0}
}

# Set up trap to ensure cleanup on exit
trap 'cleanup $?' EXIT INT TERM

echo "Starting E2E test..."

# Step 1: Start the server using Docker Compose
echo "Starting server with Docker Compose..."
cd "$SERVER_DIR" && docker-compose up -d

# Wait for server to start
echo "Waiting for server to start..."
sleep 5

# Step 2: Build the MCP client Docker image if needed
echo "Building MCP client Docker image..."
cd "$MCP_CLIENT_DIR" && docker build -t ai-mcp-logger-mcp-client .

# Step 3: Run the MCP client to append a log
echo "Running MCP client to append a log..."
APPEND_INPUT=$(cat <<EOF
{
  "type": "function_call",
  "name": "append_to_log",
  "arguments": {
    "log_name": "$TEST_LOG_NAME",
    "data": $TEST_DATA
  }
}
EOF
)

APPEND_OUTPUT=$(echo "$APPEND_INPUT" | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 ai-mcp-logger-mcp-client)
echo "Append output: $APPEND_OUTPUT"

# Check if append was successful
if ! echo "$APPEND_OUTPUT" | grep -q "success"; then
  echo -e "${RED}Test failed: Append operation was not successful${NC}"
  exit 1
fi

# Step 4: Run the MCP client to get the log
echo "Running MCP client to get the log..."
GET_INPUT=$(cat <<EOF
{
  "type": "function_call",
  "name": "get_log_by_name",
  "arguments": {
    "log_name": "$TEST_LOG_NAME"
  }
}
EOF
)

GET_OUTPUT=$(echo "$GET_INPUT" | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 ai-mcp-logger-mcp-client)
echo "Get output: $GET_OUTPUT"

# Check if get was successful and contains our test message
if ! echo "$GET_OUTPUT" | grep -q "Test message"; then
  echo -e "${RED}Test failed: Could not find test message in log${NC}"
  exit 1
fi

# Step 5: Run the MCP client to search logs
echo "Running MCP client to search logs..."
SEARCH_INPUT=$(cat <<EOF
{
  "type": "function_call",
  "name": "search_logs",
  "arguments": {
    "query": "Test message"
  }
}
EOF
)

SEARCH_OUTPUT=$(echo "$SEARCH_INPUT" | docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 ai-mcp-logger-mcp-client)
echo "Search output: $SEARCH_OUTPUT"

# Check if search was successful and found our test message
if ! echo "$SEARCH_OUTPUT" | grep -q "Test message"; then
  echo -e "${RED}Test failed: Search did not find test message${NC}"
  exit 1
fi

echo -e "${GREEN}All tests passed! 🎉${NC}"
