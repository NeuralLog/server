import { StorageAdapter } from './StorageAdapter';
import logger from '../utils/logger';
import { LogEntry, LogStatistics, AggregateStatistics } from '@neurallog/shared';

// Server namespace prefix for all data
const SERVER_NAMESPACE = 'logserver';

/**
 * Memory storage adapter for storing log entries
 */
export class MemoryStorageAdapter implements StorageAdapter {
  // Map of log names to log entries
  private logs: Map<string, LogEntry[]> = new Map();
  private initialized: boolean = false;
  private namespace: string;

  // Statistics storage
  private statistics: {
    totalLogs: number;
    totalEntries: number;
    logStats: Map<string, {
      entryCount: number;
      firstEntryTimestamp?: number;
      lastEntryTimestamp?: number;
    }>;
  } = {
    totalLogs: 0,
    totalEntries: 0,
    logStats: new Map()
  };

  /**
   * Constructor
   *
   * @param namespace Namespace for this storage adapter
   */
  constructor(namespace: string = 'default') {
    this.namespace = namespace;
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
   * Get the results database name
   */
  public get resultsDb(): string {
    return 'memory';
  }

  /**
   * Initialize the storage adapter
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize statistics
    this.statistics = {
      totalLogs: 0,
      totalEntries: 0,
      logStats: new Map()
    };

    // Calculate initial statistics for existing logs
    if (this.logs.size > 0) {
      // Count logs
      this.statistics.totalLogs = this.logs.size;

      // Process each log
      for (const [logName, entries] of this.logs.entries()) {
        // Skip if no entries
        if (!entries || entries.length === 0) continue;

        // Count entries
        const entryCount = entries.length;
        this.statistics.totalEntries += entryCount;

        // Find first and last entry timestamps
        let firstEntryTimestamp: number | undefined;
        let lastEntryTimestamp: number | undefined;

        for (const entry of entries) {
          const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
          if (timestamp) {
            if (!firstEntryTimestamp || timestamp < firstEntryTimestamp) {
              firstEntryTimestamp = timestamp;
            }
            if (!lastEntryTimestamp || timestamp > lastEntryTimestamp) {
              lastEntryTimestamp = timestamp;
            }
          }
        }

        // Add log statistics
        this.statistics.logStats.set(logName, {
          entryCount,
          firstEntryTimestamp,
          lastEntryTimestamp
        });
      }

      logger.info(`Initialized statistics: ${this.statistics.totalLogs} logs, ${this.statistics.totalEntries} entries`);
    }

    this.initialized = true;
    logger.info(`Memory storage adapter initialized for ${SERVER_NAMESPACE}:${this.namespace}`);
  }

  /**
   * Store a log entry
   *
   * @param logId Log ID
   * @param logName Log name
   * @param logData Log data
   */
  public async storeLogEntry(logId: string, logName: string, logData: any): Promise<void> {
    try {
      await this.initialize();

      // Create the log entry
      const entry: LogEntry = {
        id: logId,
        name: logName,
        data: logData,
        timestamp: new Date().toISOString()
      };

      // Get or create the log array
      if (!this.logs.has(logName)) {
        this.logs.set(logName, []);
        // Increment total logs count when a new log is created
        this.statistics.totalLogs++;
      }

      // Add the entry to the log
      const logEntries = this.logs.get(logName)!;
      logEntries.push(entry);

      // Update statistics
      await this.updateStatisticsOnAdd(logName, entry);

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
    try {
      // Get the log entries
      const logEntries = this.logs.get(logName) || [];

      // Find the entry with the specified ID
      const entry = logEntries.find(entry => entry.id === logId);

      if (entry) {
        logger.info(`Retrieved log entry: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
        return entry;
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
   * @param logData Log data
   * @returns True if the log entry was updated, false if it didn't exist
   */
  public async updateLogEntryById(logName: string, logId: string, logData: any): Promise<boolean> {
    try {
      await this.initialize();

      // Get the log entries
      const logEntries = this.logs.get(logName) || [];

      // Find the index of the entry with the specified ID
      const index = logEntries.findIndex(entry => entry.id === logId);

      if (index === -1) {
        logger.info(`Log entry not found for update: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
        return false;
      }

      // Save the old entry for statistics update
      const oldEntry = { ...logEntries[index] };

      // Update the entry
      logEntries[index] = {
        ...logEntries[index],
        data: logData,
        timestamp: new Date().toISOString()
      };

      // Update statistics
      await this.updateStatisticsOnUpdate(logName, oldEntry, logEntries[index]);

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
    try {
      await this.initialize();

      // Get the log entries
      const logEntries = this.logs.get(logName) || [];

      // Find the index of the entry with the specified ID
      const index = logEntries.findIndex(entry => entry.id === logId);

      if (index === -1) {
        logger.info(`Log entry not found for deletion: ${logName}, ID: ${logId}, namespace: ${this.namespace}`);
        return false;
      }

      // Get the entry before removing it
      const entry = logEntries[index];

      // Remove the entry
      logEntries.splice(index, 1);

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
    try {
      // Get the log entries
      const logEntries = this.logs.get(logName) || [];

      // Sort by timestamp (newest first) and limit the number of entries
      const sortedEntries = [...logEntries]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);

      logger.info(`Retrieved ${sortedEntries.length} entries for log: ${logName}, namespace: ${this.namespace}`);
      return sortedEntries;
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
    try {
      // Get all log names
      const logNames = Array.from(this.logs.keys());

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
    try {
      await this.initialize();

      // Check if the log exists
      if (!this.logs.has(logName)) {
        logger.info(`Log not found: ${logName}, namespace: ${this.namespace}`);
        return false;
      }

      // Update statistics before clearing
      await this.updateStatisticsOnClear(logName);

      // Clear the log
      this.logs.delete(logName);

      logger.info(`Cleared log: ${logName}, namespace: ${this.namespace}`);
      return true;
    } catch (error) {
      logger.error(`Error clearing log: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Close the storage adapter
   * This is used to clean up resources when the adapter is no longer needed
   */
  public async close(): Promise<void> {
    // Nothing to do for memory storage
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
    const {
      query,
      logName,
      startTime,
      endTime,
      fieldFilters,
      limit = 100
    } = options;

    let results: Array<{logName: string; entry: any}> = [];
    let resultCount = 0;

    // If logName is specified, search only that log, otherwise search all logs
    if (logName) {
      // Get entries for the specified log
      const entries = await this.getLogsByName(logName, 1000);

      // Apply filters
      const filteredEntries = this.filterEntries(entries, {
        query,
        startTime,
        endTime,
        fieldFilters
      });

      // Add matching entries to results
      const entriesToAdd = filteredEntries.slice(0, limit);
      results = entriesToAdd.map(entry => ({
        logName,
        entry
      }));
    } else {
      // Get all log names
      const logNames = await this.getLogNames(1000);

      // Search through each log
      for (const name of logNames) {
        if (resultCount >= limit) break;

        // Get entries for this log
        const entries = await this.getLogsByName(name, 1000);

        // Apply filters
        const filteredEntries = this.filterEntries(entries, {
          query,
          startTime,
          endTime,
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
    startTime?: string;
    endTime?: string;
    fieldFilters?: Record<string, any>;
  }): any[] {
    const {
      query,
      startTime,
      endTime,
      fieldFilters
    } = options;

    let filteredEntries = [...entries];

    // Apply time filters
    if (startTime) {
      const startTimeMs = new Date(startTime).getTime();
      filteredEntries = filteredEntries.filter(entry =>
        new Date(entry.timestamp).getTime() >= startTimeMs
      );
    }

    if (endTime) {
      const endTimeMs = new Date(endTime).getTime();
      filteredEntries = filteredEntries.filter(entry =>
        new Date(entry.timestamp).getTime() <= endTimeMs
      );
    }

    // Apply field filters
    if (fieldFilters) {
      filteredEntries = filteredEntries.filter(entry => {
        for (const [field, value] of Object.entries(fieldFilters)) {
          // Use getNestedProperty to handle nested fields with dot notation (e.g., "data.level")
          const entryValue = this.getNestedProperty(entry, field);
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
   * Get a nested property from an object
   *
   * @param obj Object to get property from
   * @param path Path to property
   * @returns Property value or undefined if not found
   */
  private getNestedProperty(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Get aggregate statistics for all logs
   *
   * @returns Statistics object with total logs, total entries, and per-log statistics
   */
  public async getAggregateStatistics(): Promise<AggregateStatistics> {
    await this.initialize();

    // Convert the Map to an array for the response
    const logStats = Array.from(this.statistics.logStats.entries()).map(([logName, stats]) => ({
      logName,
      ...stats
    }));

    // Sort log stats by entry count (descending)
    logStats.sort((a, b) => b.entryCount - a.entryCount);

    return {
      totalLogs: this.statistics.totalLogs,
      totalEntries: this.statistics.totalEntries,
      logStats
    };
  }

  /**
   * Get statistics for a specific log
   *
   * @param logName Log name
   * @returns Statistics object for the specified log
   */
  public async getLogStatistics(logName: string): Promise<LogStatistics | null> {
    await this.initialize();

    const stats = this.statistics.logStats.get(logName);
    if (!stats) return null;

    return {
      logName,
      ...stats
    };
  }

  /**
   * Update statistics for a log when an entry is added
   *
   * @param logName Log name
   * @param entry Log entry
   */
  public async updateStatisticsOnAdd(logName: string, entry: LogEntry): Promise<void> {
    await this.initialize();

    // Always increment total entries
    this.statistics.totalEntries++;

    // Get or create log stats
    let logStats = this.statistics.logStats.get(logName);

    // Create new stats object if it doesn't exist
    if (!logStats) {
      logStats = {
        entryCount: 0, // Will be incremented below
        firstEntryTimestamp: undefined,
        lastEntryTimestamp: undefined
      };
      this.statistics.logStats.set(logName, logStats);
    }

    // Always increment the entry count
    logStats.entryCount++;
    logStats.lastEntryTimestamp = new Date(entry.timestamp).getTime();

    // Update timestamps
    const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
    if (timestamp) {
      if (!logStats.firstEntryTimestamp || timestamp < logStats.firstEntryTimestamp) {
        logStats.firstEntryTimestamp = timestamp;
      }
      if (!logStats.lastEntryTimestamp || timestamp > logStats.lastEntryTimestamp) {
        logStats.lastEntryTimestamp = timestamp;
      }
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
    await this.initialize();

    // Get log stats
    const logStats = this.statistics.logStats.get(logName);
    if (!logStats) return;

    // Update timestamps if needed
    const newTimestamp = newEntry.timestamp ? new Date(newEntry.timestamp).getTime() : undefined;
    if (newTimestamp) {
      // Check if we need to update the first entry timestamp
      const oldTimestamp = oldEntry.timestamp ? new Date(oldEntry.timestamp).getTime() : undefined;
      if (oldTimestamp && oldTimestamp === logStats.firstEntryTimestamp) {
        // The updated entry was the first entry, recalculate
        await this.recalculateLogStatistics(logName);
        return;
      }

      // Check if we need to update the last entry timestamp
      if (oldTimestamp && oldTimestamp === logStats.lastEntryTimestamp) {
        // The updated entry was the last entry, recalculate
        await this.recalculateLogStatistics(logName);
        return;
      }

      // Check if the new timestamp becomes the first or last
      if (!logStats.firstEntryTimestamp || newTimestamp < logStats.firstEntryTimestamp) {
        logStats.firstEntryTimestamp = newTimestamp;
      }
      if (!logStats.lastEntryTimestamp || newTimestamp > logStats.lastEntryTimestamp) {
        logStats.lastEntryTimestamp = newTimestamp;
      }
    }
  }

  /**
   * Update statistics for a log when an entry is deleted
   *
   * @param logName Log name
   * @param entry Log entry
   */
  public async updateStatisticsOnDelete(logName: string, entry: LogEntry): Promise<void> {
    await this.initialize();

    // Get log stats
    const logStats = this.statistics.logStats.get(logName);
    if (!logStats) return;

    // Update entry count
    logStats.entryCount--;
    this.statistics.totalEntries--;

    // If no more entries, remove the log stats
    if (logStats.entryCount <= 0) {
      this.statistics.logStats.delete(logName);
      this.statistics.totalLogs--;
      return;
    }

    // Check if we need to recalculate timestamps
    const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
    if (timestamp && (timestamp === logStats.firstEntryTimestamp || timestamp === logStats.lastEntryTimestamp)) {
      // The deleted entry was the first or last entry, recalculate
      await this.recalculateLogStatistics(logName);
    }
  }

  /**
   * Update statistics for a log when it is cleared
   *
   * @param logName Log name
   */
  public async updateStatisticsOnClear(logName: string): Promise<void> {
    await this.initialize();

    // Get log stats
    const logStats = this.statistics.logStats.get(logName);
    if (!logStats) return;

    // Update total entries
    this.statistics.totalEntries -= logStats.entryCount;

    // Remove the log stats
    this.statistics.logStats.delete(logName);
    this.statistics.totalLogs--;
  }

  /**
   * Recalculate statistics for a log
   *
   * @param logName Log name
   */
  private async recalculateLogStatistics(logName: string): Promise<void> {
    // Get log entries
    const entries = this.logs.get(logName) || [];

    // Get or create log stats
    let logStats = this.statistics.logStats.get(logName);
    if (!logStats) {
      logStats = {
        entryCount: 0,
        firstEntryTimestamp: undefined,
        lastEntryTimestamp: undefined
      };
      this.statistics.logStats.set(logName, logStats);
    }

    // Update entry count
    logStats.entryCount = entries.length;

    // Reset timestamps
    logStats.firstEntryTimestamp = undefined;
    logStats.lastEntryTimestamp = undefined;

    // Recalculate timestamps
    for (const entry of entries) {
      const timestamp = entry.timestamp ? new Date(entry.timestamp).getTime() : undefined;
      if (timestamp) {
        if (!logStats.firstEntryTimestamp || timestamp < logStats.firstEntryTimestamp) {
          logStats.firstEntryTimestamp = timestamp;
        }
        if (!logStats.lastEntryTimestamp || timestamp > logStats.lastEntryTimestamp) {
          logStats.lastEntryTimestamp = timestamp;
        }
      }
    }
  }
}
