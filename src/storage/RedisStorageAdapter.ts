import { StorageAdapter } from './StorageAdapter';
import Redis from 'ioredis';
import logger from '../utils/logger';

/**
 * Redis connection options
 */
export interface RedisOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  url?: string;
  tls?: boolean;
  keyPrefix?: string;
}

/**
 * Redis storage adapter for storing log entries
 */
export class RedisStorageAdapter implements StorageAdapter {
  private client: Redis;
  private initialized: boolean = false;
  private defaultNamespace: string = 'default';

  /**
   * Constructor
   *
   * @param options Redis connection options
   */
  constructor(options: RedisOptions = {}) {
    // Create Redis client
    if (options.url) {
      this.client = new Redis(options.url, {
        keyPrefix: options.keyPrefix,
        tls: options.tls ? {} : undefined
      });
    } else {
      this.client = new Redis({
        host: options.host || 'localhost',
        port: options.port || 6379,
        password: options.password,
        db: options.db || 0,
        keyPrefix: options.keyPrefix,
        tls: options.tls ? {} : undefined
      });
    }

    // Handle Redis errors
    this.client.on('error', (error) => {
      logger.error(`Redis error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  /**
   * Initialize the adapter
   *
   * @param namespace Optional namespace for logical isolation of data
   */
  public async initialize(namespace?: string): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Test connection
      await this.client.ping();
      
      // Set default namespace if provided
      if (namespace) {
        this.defaultNamespace = namespace;
      }
      
      this.initialized = true;
      logger.info(`Redis storage adapter initialized with namespace: ${this.defaultNamespace}`);
    } catch (error) {
      logger.error(`Error initializing RedisStorageAdapter: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Store a log entry
   *
   * @param logId Log ID
   * @param logName Log name
   * @param logEntry Log entry
   * @param namespace Optional namespace for logical isolation of data
   */
  public async storeLogEntry(logId: string, logName: string, logEntry: any, namespace?: string): Promise<void> {
    await this.ensureInitialized();
    const ns = namespace || this.defaultNamespace;

    try {
      // Create a document with the log entry
      const document = {
        id: logId,
        name: logName,
        data: logEntry,
        timestamp: new Date().toISOString()
      };

      // Store the log entry
      const logKey = this.getLogKey(ns, logName, logId);
      await this.client.set(logKey, JSON.stringify(document));

      // Add to the log name set
      const logNamesKey = this.getLogNamesKey(ns);
      await this.client.sadd(logNamesKey, logName);

      // Add to the log entries sorted set (for time-based queries)
      const logEntriesKey = this.getLogEntriesKey(ns, logName);
      await this.client.zadd(logEntriesKey, new Date(document.timestamp).getTime(), logId);

      logger.info(`Stored log entry: ${logName}, ID: ${logId}, namespace: ${ns}`);
    } catch (error) {
      logger.error(`Error storing log entry: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get a log entry by ID
   *
   * @param logName Log name
   * @param logId Log ID
   * @param namespace Optional namespace for logical isolation of data
   * @returns Log entry or null if not found
   */
  public async getLogEntryById(logName: string, logId: string, namespace?: string): Promise<any | null> {
    await this.ensureInitialized();
    const ns = namespace || this.defaultNamespace;

    try {
      // Get the log entry
      const logKey = this.getLogKey(ns, logName, logId);
      const entry = await this.client.get(logKey);

      if (entry) {
        logger.info(`Retrieved log entry: ${logName}, ID: ${logId}, namespace: ${ns}`);
        return JSON.parse(entry);
      } else {
        logger.info(`Log entry not found: ${logName}, ID: ${logId}, namespace: ${ns}`);
        return null;
      }
    } catch (error) {
      logger.error(`Error getting log entry by ID: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Update a log entry by ID
   *
   * @param logName Log name
   * @param logId Log ID
   * @param logEntry Log entry
   * @param namespace Optional namespace for logical isolation of data
   * @returns True if the log entry was updated, false if it didn't exist
   */
  public async updateLogEntryById(logName: string, logId: string, logEntry: any, namespace?: string): Promise<boolean> {
    await this.ensureInitialized();
    const ns = namespace || this.defaultNamespace;

    try {
      // Check if the log entry exists
      const logKey = this.getLogKey(ns, logName, logId);
      const existingEntry = await this.client.get(logKey);

      if (!existingEntry) {
        logger.info(`Log entry not found for update: ${logName}, ID: ${logId}, namespace: ${ns}`);
        return false;
      }

      // Parse the existing entry
      const existing = JSON.parse(existingEntry);

      // Create updated document
      const document = {
        ...existing,
        data: logEntry,
        timestamp: new Date().toISOString()
      };

      // Update the log entry
      await this.client.set(logKey, JSON.stringify(document));

      // Update the timestamp in the sorted set
      const logEntriesKey = this.getLogEntriesKey(ns, logName);
      await this.client.zadd(logEntriesKey, new Date(document.timestamp).getTime(), logId);

      logger.info(`Updated log entry: ${logName}, ID: ${logId}, namespace: ${ns}`);
      return true;
    } catch (error) {
      logger.error(`Error updating log entry: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Delete a log entry by ID
   *
   * @param logName Log name
   * @param logId Log ID
   * @param namespace Optional namespace for logical isolation of data
   * @returns True if the log entry was deleted, false if it didn't exist
   */
  public async deleteLogEntryById(logName: string, logId: string, namespace?: string): Promise<boolean> {
    await this.ensureInitialized();
    const ns = namespace || this.defaultNamespace;

    try {
      // Delete the log entry
      const logKey = this.getLogKey(ns, logName, logId);
      const deleted = await this.client.del(logKey);

      // Remove from the sorted set
      const logEntriesKey = this.getLogEntriesKey(ns, logName);
      await this.client.zrem(logEntriesKey, logId);

      if (deleted > 0) {
        logger.info(`Deleted log entry: ${logName}, ID: ${logId}, namespace: ${ns}`);
        return true;
      } else {
        logger.info(`Log entry not found for deletion: ${logName}, ID: ${logId}, namespace: ${ns}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error deleting log entry: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Get logs by name
   *
   * @param logName Log name
   * @param limit Maximum number of logs to return
   * @param namespace Optional namespace for logical isolation of data
   * @returns Logs
   */
  public async getLogsByName(logName: string, limit: number = 100, namespace?: string): Promise<any[]> {
    await this.ensureInitialized();
    const ns = namespace || this.defaultNamespace;

    try {
      // Get log IDs from the sorted set (newest first)
      const logEntriesKey = this.getLogEntriesKey(ns, logName);
      const logIds = await this.client.zrevrange(logEntriesKey, 0, limit - 1);

      if (logIds.length === 0) {
        logger.info(`No logs found for: ${logName}, namespace: ${ns}`);
        return [];
      }

      // Get log entries
      const pipeline = this.client.pipeline();
      for (const logId of logIds) {
        const logKey = this.getLogKey(ns, logName, logId);
        pipeline.get(logKey);
      }

      const results = await pipeline.exec();
      const entries = results
        .filter(result => result && result[1])
        .map(result => JSON.parse(result[1] as string));

      logger.info(`Retrieved ${entries.length} entries for log: ${logName}, namespace: ${ns}`);
      return entries;
    } catch (error) {
      logger.error(`Error getting logs by name: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get all log names
   *
   * @param limit Maximum number of log names to return (default: 1000)
   * @param namespace Optional namespace for logical isolation of data
   * @returns Array of log names
   */
  public async getLogNames(limit: number = 1000, namespace?: string): Promise<string[]> {
    await this.ensureInitialized();
    const ns = namespace || this.defaultNamespace;

    try {
      // Get log names from the set
      const logNamesKey = this.getLogNamesKey(ns);
      const logNames = await this.client.smembers(logNamesKey);

      // Limit the number of log names if needed
      const limitedLogNames = logNames.slice(0, limit);

      logger.info(`Retrieved ${limitedLogNames.length} log names, namespace: ${ns}`);
      return limitedLogNames;
    } catch (error) {
      logger.error(`Error getting log names: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Clear a log
   *
   * @param logName Log name
   * @param namespace Optional namespace for logical isolation of data
   * @returns True if the log was cleared, false if it didn't exist
   */
  public async clearLog(logName: string, namespace?: string): Promise<boolean> {
    await this.ensureInitialized();
    const ns = namespace || this.defaultNamespace;

    try {
      // Get log IDs from the sorted set
      const logEntriesKey = this.getLogEntriesKey(ns, logName);
      const logIds = await this.client.zrange(logEntriesKey, 0, -1);

      if (logIds.length === 0) {
        logger.info(`Log not found: ${logName}, namespace: ${ns}`);
        return false;
      }

      // Delete all log entries
      const pipeline = this.client.pipeline();
      for (const logId of logIds) {
        const logKey = this.getLogKey(ns, logName, logId);
        pipeline.del(logKey);
      }

      // Clear the sorted set
      pipeline.del(logEntriesKey);

      // Remove from the log names set
      const logNamesKey = this.getLogNamesKey(ns);
      pipeline.srem(logNamesKey, logName);

      await pipeline.exec();

      logger.info(`Cleared log: ${logName}, removed ${logIds.length} entries, namespace: ${ns}`);
      return true;
    } catch (error) {
      logger.error(`Error clearing log: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Close the adapter
   * This is used to clean up resources when the adapter is no longer needed
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit();
      this.initialized = false;
      logger.info('Redis storage adapter closed');
    } catch (error) {
      logger.error(`Error closing Redis storage adapter: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search logs based on various criteria
   *
   * @param options Search options
   * @returns Search results
   */
  public async searchLogs(options: {
    query?: string;
    logName?: string;
    startTime?: string;
    endTime?: string;
    fieldFilters?: Record<string, any>;
    limit?: number;
    namespace?: string;
  }): Promise<Array<{logName: string; entry: any}>> {
    await this.ensureInitialized();
    const {
      query,
      logName,
      startTime,
      endTime,
      fieldFilters,
      limit = 100,
      namespace
    } = options;

    const ns = namespace || this.defaultNamespace;
    let results: Array<{logName: string; entry: any}> = [];

    try {
      // If logName is specified, search only that log, otherwise search all logs
      if (logName) {
        // Get entries for the specified log
        const entries = await this.getLogEntriesWithTimeFilter(logName, startTime, endTime, limit, ns);

        // Apply filters
        const filteredEntries = this.filterEntries(entries, {
          query,
          fieldFilters
        });

        // Add matching entries to results
        results = filteredEntries.map(entry => ({
          logName,
          entry
        }));
      } else {
        // Get all log names
        const logNames = await this.getLogNames(1000, ns);
        let resultCount = 0;

        // Search through each log
        for (const name of logNames) {
          if (resultCount >= limit) break;

          // Get entries for this log with time filter
          const entries = await this.getLogEntriesWithTimeFilter(name, startTime, endTime, limit, ns);

          // Apply filters
          const filteredEntries = this.filterEntries(entries, {
            query,
            fieldFilters
          });

          if (filteredEntries.length > 0) {
            // Calculate how many entries to add
            const countToAdd = Math.min(filteredEntries.length, limit - resultCount);
            resultCount += countToAdd;

            // Add matching entries to results
            results = results.concat(
              filteredEntries.slice(0, countToAdd).map(entry => ({
                logName: name,
                entry
              }))
            );
          }
        }
      }

      return results;
    } catch (error) {
      logger.error(`Error searching logs: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get log entries with time filter
   *
   * @param logName Log name
   * @param startTime Start time
   * @param endTime End time
   * @param limit Maximum number of entries to return
   * @param namespace Namespace
   * @returns Log entries
   */
  private async getLogEntriesWithTimeFilter(
    logName: string,
    startTime?: string,
    endTime?: string,
    limit: number = 100,
    namespace: string = 'default'
  ): Promise<any[]> {
    // Convert times to timestamps
    const startScore = startTime ? new Date(startTime).getTime() : '-inf';
    const endScore = endTime ? new Date(endTime).getTime() : '+inf';

    // Get log IDs from the sorted set
    const logEntriesKey = this.getLogEntriesKey(namespace, logName);
    const logIds = await this.client.zrevrangebyscore(logEntriesKey, endScore, startScore, 'LIMIT', 0, limit);

    if (logIds.length === 0) {
      return [];
    }

    // Get log entries
    const pipeline = this.client.pipeline();
    for (const logId of logIds) {
      const logKey = this.getLogKey(namespace, logName, logId);
      pipeline.get(logKey);
    }

    const results = await pipeline.exec();
    return results
      .filter(result => result && result[1])
      .map(result => JSON.parse(result[1] as string));
  }

  /**
   * Filter entries based on search criteria
   *
   * @param entries Entries to filter
   * @param options Filter options
   * @returns Filtered entries
   */
  private filterEntries(entries: any[], options: {
    query?: string;
    fieldFilters?: Record<string, any>;
  }): any[] {
    const {
      query,
      fieldFilters
    } = options;

    let filteredEntries = [...entries];

    // Apply field filters
    if (fieldFilters) {
      filteredEntries = filteredEntries.filter(entry => {
        for (const [field, value] of Object.entries(fieldFilters)) {
          // Handle nested fields with dot notation (e.g., "data.level")
          const fieldParts = field.split('.');
          let entryValue = entry;

          for (const part of fieldParts) {
            if (entryValue === undefined || entryValue === null) return false;
            entryValue = entryValue[part];
          }

          if (entryValue !== value) return false;
        }
        return true;
      });
    }

    // Apply text search
    if (query) {
      const searchText = query.toLowerCase();
      filteredEntries = filteredEntries.filter(entry =>
        JSON.stringify(entry).toLowerCase().includes(searchText)
      );
    }

    return filteredEntries;
  }

  /**
   * Ensure the adapter is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get the key for a log entry
   *
   * @param namespace Namespace
   * @param logName Log name
   * @param logId Log ID
   * @returns Redis key
   */
  private getLogKey(namespace: string, logName: string, logId: string): string {
    return `${namespace}:logs:${logName}:${logId}`;
  }

  /**
   * Get the key for log names set
   *
   * @param namespace Namespace
   * @returns Redis key
   */
  private getLogNamesKey(namespace: string): string {
    return `${namespace}:lognames`;
  }

  /**
   * Get the key for log entries sorted set
   *
   * @param namespace Namespace
   * @param logName Log name
   * @returns Redis key
   */
  private getLogEntriesKey(namespace: string, logName: string): string {
    return `${namespace}:logs:${logName}:entries`;
  }
}
