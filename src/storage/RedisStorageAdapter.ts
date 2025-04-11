import { StorageAdapter } from './StorageAdapter';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { LogEntry, LogStatistics, AggregateStatistics } from '@neurallog/shared';

// Server namespace prefix for all keys
const SERVER_NAMESPACE = 'logserver';

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
  private namespace: string;

  // No in-memory statistics storage - everything is stored in Redis

  /**
   * Constructor
   *
   * @param namespace Namespace for this storage adapter
   * @param options Redis connection options
   */
  constructor(namespace: string = 'default', options: RedisOptions = {}) {
    this.namespace = namespace;
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
   * Get the namespace for this storage adapter
   *
   * @returns The namespace for this storage adapter
   */
  public getNamespace(): string {
    return this.namespace;
  }

  /**
   * Initialize the adapter
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Test connection
      await this.client.ping();

      this.initialized = true;
      logger.info(`Redis storage adapter initialized for ${SERVER_NAMESPACE}:${this.namespace}`);
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
   * @param logData Log data
   */
  public async storeLogEntry(logId: string, logName: string, logData: any): Promise<void> {
    await this.ensureInitialized();

    try {
      // Create a document with the log entry
      const document: LogEntry = {
        id: logId,
        name: logName,
        data: logData,
        timestamp: new Date().toISOString()
      };

      // Store the log entry
      const logKey = this.getLogKey(logName, logId);
      await this.client.set(logKey, JSON.stringify(document));

      // Add to the log name set
      const logNamesKey = this.getLogNamesKey();
      await this.client.sadd(logNamesKey, logName);

      // Add to the log entries sorted set (for time-based queries)
      const logEntriesKey = this.getLogEntriesKey(logName);
      await this.client.zadd(logEntriesKey, new Date(document.timestamp).getTime(), logId);

      // Update statistics
      await this.updateStatisticsOnAdd(logName, document);

      logger.info(`Stored log entry: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
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
   * @returns Log entry or null if not found
   */
  public async getLogEntryById(logName: string, logId: string): Promise<any | null> {
    await this.ensureInitialized();

    try {
      // Get the log entry
      const logKey = this.getLogKey(logName, logId);
      const entry = await this.client.get(logKey);

      if (entry) {
        logger.info(`Retrieved log entry: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
        return JSON.parse(entry);
      } else {
        logger.info(`Log entry not found: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
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
   * @returns True if the log entry was updated, false if it didn't exist
   */
  public async updateLogEntryById(logName: string, logId: string, logEntry: any): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Check if the log entry exists
      const logKey = this.getLogKey(logName, logId);
      const existingEntry = await this.client.get(logKey);

      if (!existingEntry) {
        logger.info(`Log entry not found for update: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
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
      const logEntriesKey = this.getLogEntriesKey(logName);
      await this.client.zadd(logEntriesKey, new Date(document.timestamp).getTime(), logId);

      // Update statistics
      await this.updateStatisticsOnUpdate(logName, existing, document);

      logger.info(`Updated log entry: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
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
   * @returns True if the log entry was deleted, false if it didn't exist
   */
  public async deleteLogEntryById(logName: string, logId: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Get the log entry before deleting it
      const logKey = this.getLogKey(logName, logId);
      const entryJson = await this.client.get(logKey);

      if (!entryJson) {
        logger.info(`Log entry not found for deletion: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
        return false;
      }

      // Parse the entry
      const entry = JSON.parse(entryJson);

      // Delete the log entry
      await this.client.del(logKey);

      // Remove from the sorted set
      const logEntriesKey = this.getLogEntriesKey(logName);
      await this.client.zrem(logEntriesKey, logId);

      // Update statistics
      await this.updateStatisticsOnDelete(logName, entry);

      logger.info(`Deleted log entry: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
      return true;
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
   * @returns Logs
   */
  public async getLogsByName(logName: string, limit: number = 100): Promise<any[]> {
    await this.ensureInitialized();

    try {
      // Get log IDs from the sorted set (newest first)
      const logEntriesKey = this.getLogEntriesKey(logName);
      const logIds = await this.client.zrevrange(logEntriesKey, 0, limit - 1);

      if (logIds.length === 0) {
        logger.info(`No logs found for: ${logName}, namespace: ${this.namespace}`);
        return [];
      }

      // Get log entries
      const pipeline = this.client.pipeline();
      for (const logId of logIds) {
        const logKey = this.getLogKey(logName, logId);
        pipeline.get(logKey);
      }

      const results = await pipeline.exec();
      const entries = results ? results
        .filter(result => result && result[1])
        .map(result => JSON.parse(result[1] as string)) : [];

      logger.info(`Retrieved ${entries.length} entries for log: ${logName}, namespace: ${this.namespace}`);
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
   * @returns Array of log names
   */
  public async getLogNames(limit: number = 1000): Promise<string[]> {
    await this.ensureInitialized();

    try {
      // Get log names from the set
      const logNamesKey = this.getLogNamesKey();
      const logNames = await this.client.smembers(logNamesKey);

      // Limit the number of log names if needed
      const limitedLogNames = logNames.slice(0, limit);

      logger.info(`Retrieved ${limitedLogNames.length} log names, namespace: ${this.namespace}`);
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
   * @returns True if the log was cleared, false if it didn't exist
   */
  public async clearLog(logName: string): Promise<boolean> {
    await this.ensureInitialized();

    try {
      // Get log IDs from the sorted set
      const logEntriesKey = this.getLogEntriesKey(logName);
      const logIds = await this.client.zrange(logEntriesKey, 0, -1);

      if (logIds.length === 0) {
        logger.info(`Log not found: ${logName}, namespace: ${this.namespace}`);
        return false;
      }

      // Delete all log entries
      const pipeline = this.client.pipeline();
      for (const logId of logIds) {
        const logKey = this.getLogKey(logName, logId);
        pipeline.del(logKey);
      }

      // Clear the sorted set
      pipeline.del(logEntriesKey);

      // Remove from the log names set
      const logNamesKey = this.getLogNamesKey();
      pipeline.srem(logNamesKey, logName);

      await pipeline.exec();

      // Update statistics
      await this.updateStatisticsOnClear(logName);

      logger.info(`Cleared log: ${logName}, removed ${logIds.length} entries, namespace: ${this.namespace}`);
      return true;
    } catch (error) {
      logger.error(`Error clearing log: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
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
  }): Promise<Array<{logName: string; entry: any}>> {
    await this.ensureInitialized();
    const {
      query,
      logName,
      startTime,
      endTime,
      fieldFilters,
      limit = 100
    } = options;

    let results: Array<{logName: string; entry: any}> = [];

    try {
      // If logName is specified, search only that log, otherwise search all logs
      if (logName) {
        // Get entries for the specified log with time filter
        const entries = await this.getLogEntriesWithTimeFilter(logName, startTime, endTime, limit);

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
        const logNames = await this.getLogNames(1000);
        let resultCount = 0;

        // Search through each log
        for (const name of logNames) {
          if (resultCount >= limit) break;

          // Get entries for this log with time filter
          const entries = await this.getLogEntriesWithTimeFilter(name, startTime, endTime, limit);

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

      logger.info(`Search returned ${results.length} results, namespace: ${this.namespace}`);
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
   * @returns Log entries
   */
  private async getLogEntriesWithTimeFilter(
    logName: string,
    startTime?: string,
    endTime?: string,
    limit: number = 100
  ): Promise<any[]> {
    // Convert times to timestamps
    const startScore = startTime ? new Date(startTime).getTime() : '-inf';
    const endScore = endTime ? new Date(endTime).getTime() : '+inf';

    // Get log IDs from the sorted set
    const logEntriesKey = this.getLogEntriesKey(logName);
    const logIds = await this.client.zrevrangebyscore(logEntriesKey, endScore, startScore, 'LIMIT', 0, limit);

    if (logIds.length === 0) {
      return [];
    }

    // Get log entries
    const pipeline = this.client.pipeline();
    for (const logId of logIds) {
      const logKey = this.getLogKey(logName, logId);
      pipeline.get(logKey);
    }

    const results = await pipeline.exec();
    return results ? results
      .filter(result => result && result[1])
      .map(result => JSON.parse(result[1] as string)) : [];
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
   * Get a generic key with namespace
   *
   * @param key Key
   * @returns Redis key
   */
  private getKey(key: string): string {
    return `${SERVER_NAMESPACE}:${this.namespace}:${key}`;
  }

  /**
   * Get the key for a log entry
   *
   * @param logName Log name
   * @param logId Log ID
   * @returns Redis key
   */
  private getLogKey(logName: string, logId: string): string {
    return this.getKey(`logs:${logName}:${logId}`);
  }

  /**
   * Get the key for log names set
   *
   * @returns Redis key
   */
  private getLogNamesKey(): string {
    return this.getKey('lognames');
  }

  /**
   * Get the key for log entries sorted set
   *
   * @param logName Log name
   * @returns Redis key
   */
  private getLogEntriesKey(logName: string): string {
    return this.getKey(`logs:${logName}:entries`);
  }





  /**
   * Get aggregate statistics for all logs
   *
   * @returns Statistics object with total logs, total entries, and per-log statistics
   */
  public async getAggregateStatistics(): Promise<AggregateStatistics> {
    await this.ensureInitialized();

    try {
      // Get total logs and entries
      const totalLogsKey = this.getKey('stats:totalLogs');
      const totalEntriesKey = this.getKey('stats:totalEntries');

      const [totalLogsStr, totalEntriesStr] = await Promise.all([
        this.client.get(totalLogsKey),
        this.client.get(totalEntriesKey)
      ]);

      const totalLogs = totalLogsStr ? parseInt(totalLogsStr) : 0;
      const totalEntries = totalEntriesStr ? parseInt(totalEntriesStr) : 0;

      // Get all log names
      const logNames = await this.getLogNames();

      // Get statistics for each log
      const logStats: LogStatistics[] = [];

      for (const logName of logNames) {
        const logEntryCountKey = this.getKey(`stats:log:${logName}:entryCount`);
        const firstEntryTimestampKey = this.getKey(`stats:log:${logName}:firstEntryTimestamp`);
        const lastEntryTimestampKey = this.getKey(`stats:log:${logName}:lastEntryTimestamp`);

        const [entryCountStr, firstTimestampStr, lastTimestampStr] = await Promise.all([
          this.client.get(logEntryCountKey),
          this.client.get(firstEntryTimestampKey),
          this.client.get(lastEntryTimestampKey)
        ]);

        const entryCount = entryCountStr ? parseInt(entryCountStr) : 0;

        if (entryCount > 0) {
          logStats.push({
            logName,
            entryCount,
            firstEntryTimestamp: firstTimestampStr ? parseInt(firstTimestampStr) : undefined,
            lastEntryTimestamp: lastTimestampStr ? parseInt(lastTimestampStr) : undefined
          });
        }
      }

      // Sort log stats by entry count (descending)
      logStats.sort((a, b) => b.entryCount - a.entryCount);

      return {
        totalLogs,
        totalEntries,
        logStats
      };
    } catch (error) {
      logger.error(`Error getting aggregate statistics: ${error instanceof Error ? error.message : String(error)}`);
      return {
        totalLogs: 0,
        totalEntries: 0,
        logStats: []
      };
    }
  }

  /**
   * Get statistics for a specific log
   *
   * @param logName Log name
   * @returns Statistics object for the specified log
   */
  public async getLogStatistics(logName: string): Promise<LogStatistics | null> {
    await this.ensureInitialized();

    try {
      // Check if the log exists
      const logEntryCountKey = this.getKey(`stats:log:${logName}:entryCount`);
      const entryCountStr = await this.client.get(logEntryCountKey);

      if (!entryCountStr) return null;

      const entryCount = parseInt(entryCountStr);

      // Get timestamps
      const firstEntryTimestampKey = this.getKey(`stats:log:${logName}:firstEntryTimestamp`);
      const lastEntryTimestampKey = this.getKey(`stats:log:${logName}:lastEntryTimestamp`);

      const [firstTimestampStr, lastTimestampStr] = await Promise.all([
        this.client.get(firstEntryTimestampKey),
        this.client.get(lastEntryTimestampKey)
      ]);

      return {
        logName,
        entryCount,
        firstEntryTimestamp: firstTimestampStr ? parseInt(firstTimestampStr) : undefined,
        lastEntryTimestamp: lastTimestampStr ? parseInt(lastTimestampStr) : undefined
      };
    } catch (error) {
      logger.error(`Error getting log statistics: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Update statistics for a log when an entry is added
   *
   * @param logName Log name
   * @param entry Log entry
   */
  public async updateStatisticsOnAdd(logName: string, entry: LogEntry): Promise<void> {
    await this.ensureInitialized();

    try {
      // Get keys
      const totalEntriesKey = this.getKey('stats:totalEntries');
      const totalLogsKey = this.getKey('stats:totalLogs');
      const logEntryCountKey = this.getKey(`stats:log:${logName}:entryCount`);

      // Check if this is a new log
      const currentCount = await this.client.get(logEntryCountKey);

      // Use a multi command to ensure atomicity
      const multi = this.client.multi();

      // Always increment total entries
      multi.incr(totalEntriesKey);

      // Increment log entry count
      multi.incr(logEntryCountKey);

      // If this is a new log, increment total logs
      if (!currentCount) {
        multi.incr(totalLogsKey);
      }

      // Update timestamps if available
      const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
      if (timestamp) {
        const firstEntryTimestampKey = this.getKey(`stats:log:${logName}:firstEntryTimestamp`);
        const lastEntryTimestampKey = this.getKey(`stats:log:${logName}:lastEntryTimestamp`);

        // Get current timestamps
        const [currentFirstTimestamp, currentLastTimestamp] = await Promise.all([
          this.client.get(firstEntryTimestampKey),
          this.client.get(lastEntryTimestampKey)
        ]);

        // Update first timestamp if needed
        if (!currentFirstTimestamp || timestamp < parseInt(currentFirstTimestamp)) {
          multi.set(firstEntryTimestampKey, timestamp.toString());
        }

        // Update last timestamp if needed
        if (!currentLastTimestamp || timestamp > parseInt(currentLastTimestamp)) {
          multi.set(lastEntryTimestampKey, timestamp.toString());
        }
      }

      // Execute all commands atomically
      await multi.exec();
    } catch (error) {
      logger.error(`Error updating statistics on add: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update statistics for a log when an entry is updated
   *
   * @param logName Log name
   * @param oldEntry Old log entry
   * @param newEntry New log entry
   */
  public async updateStatisticsOnUpdate(logName: string, oldEntry: LogEntry, newEntry: LogEntry): Promise<void> {
    await this.ensureInitialized();

    try {
      // Update timestamps if needed
      const newTimestamp = newEntry.timestamp ? new Date(newEntry.timestamp).getTime() : undefined;
      if (newTimestamp) {
        const firstEntryTimestampKey = this.getKey(`stats:log:${logName}:firstEntryTimestamp`);
        const lastEntryTimestampKey = this.getKey(`stats:log:${logName}:lastEntryTimestamp`);

        // Get current timestamps
        const [currentFirstTimestampStr, currentLastTimestampStr] = await Promise.all([
          this.client.get(firstEntryTimestampKey),
          this.client.get(lastEntryTimestampKey)
        ]);

        const currentFirstTimestamp = currentFirstTimestampStr ? parseInt(currentFirstTimestampStr) : undefined;
        const currentLastTimestamp = currentLastTimestampStr ? parseInt(currentLastTimestampStr) : undefined;

        // Check if we need to update the first entry timestamp
        const oldTimestamp = oldEntry.timestamp ? new Date(oldEntry.timestamp).getTime() : undefined;

        if (oldTimestamp && currentFirstTimestamp && oldTimestamp === currentFirstTimestamp) {
          // The updated entry was the first entry, we need to recalculate
          // Get all entries for this log and find the new first timestamp
          const entries = await this.getLogsByName(logName);
          let newFirstTimestamp = newTimestamp;

          for (const entry of entries) {
            if (entry.id !== newEntry.id) { // Skip the updated entry
              const entryTimestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
              if (entryTimestamp && entryTimestamp < newFirstTimestamp) {
                newFirstTimestamp = entryTimestamp;
              }
            }
          }

          // Update the first timestamp
          await this.client.set(firstEntryTimestampKey, newFirstTimestamp.toString());
        } else if (newTimestamp && (!currentFirstTimestamp || newTimestamp < currentFirstTimestamp)) {
          // The new timestamp is earlier than the current first timestamp
          await this.client.set(firstEntryTimestampKey, newTimestamp.toString());
        }

        // Check if we need to update the last entry timestamp
        if (oldTimestamp && currentLastTimestamp && oldTimestamp === currentLastTimestamp) {
          // The updated entry was the last entry, we need to recalculate
          // Get all entries for this log and find the new last timestamp
          const entries = await this.getLogsByName(logName);
          let newLastTimestamp = newTimestamp;

          for (const entry of entries) {
            if (entry.id !== newEntry.id) { // Skip the updated entry
              const entryTimestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
              if (entryTimestamp && entryTimestamp > newLastTimestamp) {
                newLastTimestamp = entryTimestamp;
              }
            }
          }

          // Update the last timestamp
          await this.client.set(lastEntryTimestampKey, newLastTimestamp.toString());
        } else if (newTimestamp && (!currentLastTimestamp || newTimestamp > currentLastTimestamp)) {
          // The new timestamp is later than the current last timestamp
          await this.client.set(lastEntryTimestampKey, newTimestamp.toString());
        }
      }
    } catch (error) {
      logger.error(`Error updating statistics on update: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update statistics for a log when an entry is deleted
   *
   * @param logName Log name
   * @param entry Log entry
   */
  public async updateStatisticsOnDelete(logName: string, entry: LogEntry): Promise<void> {
    await this.ensureInitialized();

    try {
      // Decrement total entries counter
      const totalEntriesKey = this.getKey('stats:totalEntries');
      await this.client.decr(totalEntriesKey);

      // Decrement log entry count
      const logEntryCountKey = this.getKey(`stats:log:${logName}:entryCount`);
      const newCount = await this.client.decr(logEntryCountKey);

      // If no more entries, remove the log stats and decrement total logs
      if (newCount <= 0) {
        // Decrement total logs counter
        const totalLogsKey = this.getKey('stats:totalLogs');
        await this.client.decr(totalLogsKey);

        // Remove log statistics keys
        const firstEntryTimestampKey = this.getKey(`stats:log:${logName}:firstEntryTimestamp`);
        const lastEntryTimestampKey = this.getKey(`stats:log:${logName}:lastEntryTimestamp`);

        await Promise.all([
          this.client.del(logEntryCountKey),
          this.client.del(firstEntryTimestampKey),
          this.client.del(lastEntryTimestampKey)
        ]);

        return;
      }

      // Check if we need to recalculate timestamps
      const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
      if (timestamp) {
        const firstEntryTimestampKey = this.getKey(`stats:log:${logName}:firstEntryTimestamp`);
        const lastEntryTimestampKey = this.getKey(`stats:log:${logName}:lastEntryTimestamp`);

        const [firstTimestampStr, lastTimestampStr] = await Promise.all([
          this.client.get(firstEntryTimestampKey),
          this.client.get(lastEntryTimestampKey)
        ]);

        const firstTimestamp = firstTimestampStr ? parseInt(firstTimestampStr) : undefined;
        const lastTimestamp = lastTimestampStr ? parseInt(lastTimestampStr) : undefined;

        // If the deleted entry was the first or last, recalculate
        if ((firstTimestamp && timestamp === firstTimestamp) ||
            (lastTimestamp && timestamp === lastTimestamp)) {
          // Get all entries for this log
          const entries = await this.getLogsByName(logName);

          if (entries.length > 0) {
            // Find new first and last timestamps
            let newFirstTimestamp: number | undefined;
            let newLastTimestamp: number | undefined;

            for (const e of entries) {
              const entryTimestamp = e.timestamp ? new Date(e.timestamp).getTime() : undefined;
              if (entryTimestamp) {
                if (!newFirstTimestamp || entryTimestamp < newFirstTimestamp) {
                  newFirstTimestamp = entryTimestamp;
                }
                if (!newLastTimestamp || entryTimestamp > newLastTimestamp) {
                  newLastTimestamp = entryTimestamp;
                }
              }
            }

            // Update timestamps
            if (newFirstTimestamp) {
              await this.client.set(firstEntryTimestampKey, newFirstTimestamp.toString());
            }
            if (newLastTimestamp) {
              await this.client.set(lastEntryTimestampKey, newLastTimestamp.toString());
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error updating statistics on delete: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update statistics for a log when it is cleared
   *
   * @param logName Log name
   */
  public async updateStatisticsOnClear(logName: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // Get current entry count for this log
      const logEntryCountKey = this.getKey(`stats:log:${logName}:entryCount`);
      const entryCountStr = await this.client.get(logEntryCountKey);
      const entryCount = entryCountStr ? parseInt(entryCountStr) : 0;

      if (entryCount > 0) {
        // Decrement total entries by the log's entry count
        const totalEntriesKey = this.getKey('stats:totalEntries');
        await this.client.decrby(totalEntriesKey, entryCount);

        // Decrement total logs
        const totalLogsKey = this.getKey('stats:totalLogs');
        await this.client.decr(totalLogsKey);

        // Remove log statistics keys
        const firstEntryTimestampKey = this.getKey(`stats:log:${logName}:firstEntryTimestamp`);
        const lastEntryTimestampKey = this.getKey(`stats:log:${logName}:lastEntryTimestamp`);

        await Promise.all([
          this.client.del(logEntryCountKey),
          this.client.del(firstEntryTimestampKey),
          this.client.del(lastEntryTimestampKey)
        ]);
      }
    } catch (error) {
      logger.error(`Error updating statistics on clear: ${error instanceof Error ? error.message : String(error)}`);
    }
  }



  /**
   * Close the adapter
   * This is used to clean up resources when the adapter is no longer needed
   */
  public async close(): Promise<void> {
    this.client.disconnect();
    this.initialized = false;
    logger.info(`Redis storage adapter closed for ${SERVER_NAMESPACE}:${this.namespace}`);
  }
}
