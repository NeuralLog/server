import { execSync, spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as assert from 'assert';
import * as path from 'path';

// Configuration
const SERVER_STARTUP_TIME = 5000; // ms to wait for server to start
const SERVER_DIR = path.resolve(__dirname, '../../');
const MCP_CLIENT_DIR = path.resolve(__dirname, '../../../mcp-client');
const TEST_LOG_NAME = 'test-log';
const TEST_DATA = { message: 'Test message', timestamp: new Date().toISOString() };

// Test input for MCP client (JSON format that MCP expects)
const testInput = JSON.stringify({
  type: 'function_call',
  name: 'append_to_log',
  arguments: {
    log_name: TEST_LOG_NAME,
    data: TEST_DATA
  }
});

// Helper function to run a command and return stdout
function runCommand(command: string, cwd: string = SERVER_DIR): string {
  console.log(`Running command: ${command}`);
  return execSync(command, { cwd, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
}

// Helper function to run a command with input and capture output
function runCommandWithInput(command: string, input: string, cwd: string = SERVER_DIR): Promise<string> {
  console.log(`Running command with input: ${command}`);

  return new Promise((resolve, reject) => {
    const process: ChildProcessWithoutNullStreams = spawn(command, [], {
      cwd,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    // Write input to stdin
    process.stdin.write(input);
    process.stdin.end();
  });
}

// Interface for MCP response
interface MCPResponse {
  type: string;
  value: {
    status: string;
    entries?: Array<{
      id: string;
      timestamp: string;
      data: any;
    }>;
    message?: string;
  };
}

// Main test function
async function runE2ETest(): Promise<void> {
  try {
    console.log('Starting E2E test...');

    // Step 1: Build the server Docker image
    console.log('Building server Docker image...');
    runCommand('docker build -t ai-mcp-logger-server .', SERVER_DIR);

    // Step 2: Start the server using Docker run
    console.log('Starting server with Docker...');
    runCommand('docker run -d -p 3030:3030 --name ai-mcp-logger-server ai-mcp-logger-server', SERVER_DIR);

    // Wait for server to start
    console.log(`Waiting ${SERVER_STARTUP_TIME}ms for server to start...`);
    await new Promise(resolve => setTimeout(resolve, SERVER_STARTUP_TIME));

    // Step 2: Build the MCP client Docker image if needed
    console.log('Building MCP client Docker image...');
    runCommand('docker build -t ai-mcp-logger-mcp-client .', MCP_CLIENT_DIR);

    // Step 3: Run the MCP client with test input
    console.log('Running MCP client with test input...');
    const output = await runCommandWithInput(
      'docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 ai-mcp-logger-mcp-client',
      testInput,
      MCP_CLIENT_DIR
    );

    console.log('MCP client output:', output);

    // Step 4: Verify the output
    const outputJson: MCPResponse = JSON.parse(output);
    assert.strictEqual(outputJson.type, 'function_result', 'Output should be a function result');
    assert.strictEqual(outputJson.value.status, 'success', 'Operation should be successful');

    // Step 5: Verify the log was created by getting it
    const getLogInput = JSON.stringify({
      type: 'function_call',
      name: 'get_log_by_name',
      arguments: {
        log_name: TEST_LOG_NAME
      }
    });

    console.log('Getting log to verify it was created...');
    const getLogOutput = await runCommandWithInput(
      'docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 ai-mcp-logger-mcp-client',
      getLogInput,
      MCP_CLIENT_DIR
    );

    console.log('Get log output:', getLogOutput);

    const getLogJson: MCPResponse = JSON.parse(getLogOutput);
    assert.strictEqual(getLogJson.type, 'function_result', 'Output should be a function result');
    assert.strictEqual(getLogJson.value.status, 'success', 'Operation should be successful');
    assert.ok(getLogJson.value.entries && getLogJson.value.entries.length > 0, 'Log should have entries');
    assert.strictEqual(getLogJson.value.entries![0].data.message, TEST_DATA.message, 'Log entry should contain test message');

    // Step 6: Test search functionality
    const searchInput = JSON.stringify({
      type: 'function_call',
      name: 'search_logs',
      arguments: {
        query: 'Test message'
      }
    });

    console.log('Searching logs...');
    const searchOutput = await runCommandWithInput(
      'docker run -i --network host -e WEB_SERVER_URL=http://localhost:3030 ai-mcp-logger-mcp-client',
      searchInput,
      MCP_CLIENT_DIR
    );

    console.log('Search output:', searchOutput);

    const searchJson = JSON.parse(searchOutput);
    assert.strictEqual(searchJson.type, 'function_result', 'Output should be a function result');
    assert.ok(searchJson.value.results && searchJson.value.results.length > 0, 'Search should return results');
    assert.ok(JSON.stringify(searchJson).includes('Test message'), 'Search results should contain test message');

    console.log('Test passed! 🎉');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    // Step 7: Clean up - stop and remove containers
    console.log('Cleaning up...');
    runCommand('docker stop ai-mcp-logger-server', SERVER_DIR);
    runCommand('docker rm ai-mcp-logger-server', SERVER_DIR);
  }
}

// Run the test
runE2ETest();
