import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import logger from '../utils/logger';
import routes from './routes';

/**
 * MCP server
 */
export class MCPServer {
  private app: express.Application;
  private port: number;

  /**
   * Constructor
   *
   * @param port Port to listen on
   */
  constructor(port: number = 3030) {
    this.app = express();
    this.port = port;

    // Configure middleware
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));

    // Configure routes
    this.app.use('/', routes);

    // Error handling
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error(`Error: ${err.message}`);
      res.status(500).json({
        status: 'error',
        message: err.message
      });
    });
  }

  /**
   * Start the server
   */
  public start(): void {
    this.app.listen(this.port, () => {
      logger.info(`MCP server listening on port ${this.port}`);
    });
  }
}

/**
 * Start the server
 */
if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3030;
  const server = new MCPServer(port);
  server.start();
}
