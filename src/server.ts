import { MCPServer } from './mcp';
import logger from './utils/logger';

/**
 * Start the MCP server
 */
const port = process.env.PORT ? parseInt(process.env.PORT) : 3030;
logger.info(`Starting MCP server on port ${port}`);

const server = new MCPServer(port);
server.start();
