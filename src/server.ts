import { Server } from './server/server';
import logger from './utils/logger';

/**
 * Start the NeuralLog server
 */
const port = process.env.PORT ? parseInt(process.env.PORT) : 3030;
logger.info(`Starting NeuralLog server on port ${port}`);

const server = new Server(port);
server.start();
