import { Request, Response } from 'express';
import logger from '../../utils/logger';
import { StorageAdapter } from '../../storage/StorageAdapter';
import { StorageAdapterFactory } from '../../storage/StorageAdapterFactory';
import { v4 as uuidv4 } from 'uuid';

// Get configuration from environment variables
const DEFAULT_NAMESPACE = process.env.DEFAULT_NAMESPACE || 'default';
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'memory';
const DB_PATH = process.env.DB_PATH || './data';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_DB = process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : 0;

// Create the storage adapter with appropriate configuration
const storage: StorageAdapter = StorageAdapterFactory.createAdapter({
  type: STORAGE_TYPE as 'memory' | 'nedb' | 'redis',
  dbPath: DB_PATH,
  namespace: DEFAULT_NAMESPACE,
  redis: {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    db: REDIS_DB
  }
});

// Initialize the storage adapter
storage.initialize().catch(error => {
  logger.error(`Error initializing storage adapter: ${error instanceof Error ? error.message : String(error)}`);
});

/**
 * Generate a unique ID
 */
function generateId(): string {
  return uuidv4();
}

/**
 * Ensure data is a proper JSON object with a consistent structure
 *
 * @param data Data to process
 * @returns JSON object
 */
function ensureJsonObject(data: any): any {
  // If it's already an object (but not null or array), return it as is
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }

  // If data is null, return an empty object
  if (data === null) {
    return { data: null };
  }

  // If it's a string, check if it's JSON or a primitive
  if (typeof data === 'string') {
    // Trim whitespace for accurate detection
    const trimmed = data.trim();

    // Check if it looks like JSON (starts with { or [ and ends with } or ])
    const looksLikeJson = /^\s*[{\[].*[}\]]\s*$/s.test(trimmed);

    if (looksLikeJson) {
      try {
        const parsed = JSON.parse(trimmed);
        // If parsing succeeded and result is an object (not array), return it as is
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed;
        }
        // If it's an array or primitive from JSON, wrap it
        return { data: parsed };
      } catch (e) {
        // If parsing fails, it's not valid JSON, treat as a string
      }
    }

    // Check if it's a number string
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { data: parseFloat(trimmed) };
    }

    // Check if it's a boolean string
    if (trimmed.toLowerCase() === 'true') {
      return { data: true };
    }
    if (trimmed.toLowerCase() === 'false') {
      return { data: false };
    }

    // It's a regular string, wrap it
    return { data: data };
  }

  // For all other types (arrays, primitives), wrap them in a data field
  return { data: data };
}

/**
 * Overwrite a log (clear and add new entries)
 */
export const overwriteLog = async (req: Request, res: Response): Promise<void> => {
  const { logName } = req.params;
  const rawData = req.body;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Overwriting log: ${logName}, namespace: ${namespace}`);

    // Ensure data is a proper JSON object
    const data = ensureJsonObject(rawData);

    // Clear the log first
    await storage.clearLog(logName, namespace);

    // Generate a unique ID
    const logId = generateId();

    // Store the log entry
    await storage.storeLogEntry(logId, logName, data, namespace);

    res.json({
      status: 'success',
      logId,
      namespace
    });
  } catch (error) {
    logger.error(`Error overwriting log: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Append data to a log
 */
export const appendToLog = async (req: Request, res: Response): Promise<void> => {
  const { logName } = req.params;
  const rawData = req.body;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Appending to log: ${logName}, namespace: ${namespace}`);

    // Ensure data is a proper JSON object
    const data = ensureJsonObject(rawData);

    // Generate a unique ID
    const logId = generateId();

    // Store the log entry
    await storage.storeLogEntry(logId, logName, data, namespace);

    res.json({
      status: 'success',
      logId,
      namespace
    });
  } catch (error) {
    logger.error(`Error appending to log: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get logs by name
 */
export const getLogByName = async (req: Request, res: Response): Promise<void> => {
  const { logName } = req.params;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Getting log for: ${logName}, namespace: ${namespace}`);

    // Get logs by name
    const entries = await storage.getLogsByName(logName, limit, namespace);

    res.json({
      status: 'success',
      name: logName,
      namespace,
      entries
    });
  } catch (error) {
    logger.error(`Error getting log: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get all log names
 */
export const getLogs = async (req: Request, res: Response): Promise<void> => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 1000;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Getting all log names, namespace: ${namespace}`);

    // Get all log names
    const logNames = await storage.getLogNames(limit, namespace);

    res.json({
      status: 'success',
      namespace,
      logs: logNames
    });
  } catch (error) {
    logger.error(`Error getting log names: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Clear a log
 */
export const clearLog = async (req: Request, res: Response): Promise<void> => {
  const { logName } = req.params;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Clearing log: ${logName}, namespace: ${namespace}`);

    // Clear the log
    const success = await storage.clearLog(logName, namespace);

    res.json({
      status: 'success',
      namespace,
      cleared: success
    });
  } catch (error) {
    logger.error(`Error clearing log: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get a log entry by ID
 */
export const getLogEntryById = async (req: Request, res: Response): Promise<void> => {
  const { logName, logId } = req.params;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Getting log entry: ${logName}, ID: ${logId}, namespace: ${namespace}`);

    // Get the log entry
    const entry = await storage.getLogEntryById(logName, logId, namespace);

    if (entry) {
      res.json({
        status: 'success',
        namespace,
        entry
      });
    } else {
      res.status(404).json({
        status: 'error',
        error: `Log entry ${logId} not found in log ${logName} (namespace: ${namespace})`
      });
    }
  } catch (error) {
    logger.error(`Error getting log entry: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Update a log entry by ID
 */
export const updateLogEntryById = async (req: Request, res: Response): Promise<void> => {
  const { logName, logId } = req.params;
  const rawData = req.body;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Updating log entry: ${logName}, ID: ${logId}, namespace: ${namespace}`);

    // Ensure data is a proper JSON object
    const data = ensureJsonObject(rawData);

    // Update the log entry
    const success = await storage.updateLogEntryById(logName, logId, data, namespace);

    if (success) {
      res.json({
        status: 'success',
        namespace,
        message: `Log entry ${logId} updated in log ${logName}`
      });
    } else {
      res.status(404).json({
        status: 'error',
        error: `Log entry ${logId} not found in log ${logName} (namespace: ${namespace})`
      });
    }
  } catch (error) {
    logger.error(`Error updating log entry: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Delete a log entry by ID
 */
export const deleteLogEntryById = async (req: Request, res: Response): Promise<void> => {
  const { logName, logId } = req.params;
  const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

  try {
    logger.info(`Deleting log entry: ${logName}, ID: ${logId}, namespace: ${namespace}`);

    // Delete the log entry
    const success = await storage.deleteLogEntryById(logName, logId, namespace);

    if (success) {
      res.json({
        status: 'success',
        namespace,
        message: `Log entry ${logId} deleted from log ${logName}`
      });
    } else {
      res.status(404).json({
        status: 'error',
        error: `Log entry ${logId} not found in log ${logName} (namespace: ${namespace})`
      });
    }
  } catch (error) {
    logger.error(`Error deleting log entry: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Search logs based on various criteria
 */
export const searchLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract namespace parameter
    const namespace = req.query.namespace as string || DEFAULT_NAMESPACE;

    logger.info(`Searching logs with criteria: ${JSON.stringify(req.query)}, namespace: ${namespace}`);

    // Extract search parameters from query string
    const {
      query,
      log_name: logName,
      start_time: startTime,
      end_time: endTime,
      limit: limitStr,
      namespace: _, // Exclude namespace from otherParams
      ...otherParams
    } = req.query;

    // Parse limit parameter
    const limit = limitStr ? parseInt(limitStr as string) : 100;

    // Extract field filters from other parameters
    const fieldFilters: Record<string, any> = {};
    for (const [key, value] of Object.entries(otherParams)) {
      if (key.startsWith('field_')) {
        const fieldName = key.substring(6); // Remove 'field_' prefix
        fieldFilters[fieldName] = value;
      }
    }

    // Perform the search
    const results = await storage.searchLogs({
      query: query as string,
      logName: logName as string,
      startTime: startTime as string,
      endTime: endTime as string,
      fieldFilters: Object.keys(fieldFilters).length > 0 ? fieldFilters : undefined,
      limit,
      namespace
    });

    // Return the results
    res.json({
      status: 'success',
      namespace,
      total: results.length,
      results
    });
  } catch (error) {
    logger.error(`Error searching logs: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};
