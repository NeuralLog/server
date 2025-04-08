import { StorageAdapter } from './StorageAdapter';
import logger from '../utils/logger';

/**
 * Memory storage adapter for storing log entries
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private logs: Map<string, any[]> = new Map();
  private initialized: boolean = false;

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
    this.initialized = true;
  }

  /**
   * Store a log entry
   *
   * @param logId Log ID
   * @param logName Log name
   * @param logEntry Log entry
   */
  public async storeLogEntry(logId: string, logName: string, logEntry: any): Promise<void> {
    try {
      // Create the log entry
      const entry = {
        id: logId,
        name: logName,
        data: logEntry,
        timestamp: new Date().toISOString()
      };

      // Get or create the log array
      if (!this.logs.has(logName)) {
        this.logs.set(logName, []);
      }

      // Add the entry to the log
      const logEntries = this.logs.get(logName)!;
      logEntries.push(entry);

      logger.info(`Stored log entry: ${logName}, ID: ${logId}`);
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
        logger.info(`Retrieved log entry: ${logName}, ID: ${logId}`);
        return entry;
      } else {
        logger.info(`Log entry not found: ${logName}, ID: ${logId}`);
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
    try {
      // Get the log entries
      const logEntries = this.logs.get(logName) || [];

      // Find the index of the entry with the specified ID
      const index = logEntries.findIndex(entry => entry.id === logId);

      if (index === -1) {
        logger.info(`Log entry not found for update: ${logName}, ID: ${logId}`);
        return false;
      }

      // Update the entry
      logEntries[index] = {
        ...logEntries[index],
        data: logEntry,
        timestamp: new Date().toISOString()
      };

      logger.info(`Updated log entry: ${logName}, ID: ${logId}`);
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
      // Get the log entries
      const logEntries = this.logs.get(logName) || [];

      // Find the index of the entry with the specified ID
      const index = logEntries.findIndex(entry => entry.id === logId);

      if (index === -1) {
        logger.info(`Log entry not found for deletion: ${logName}, ID: ${logId}`);
        return false;
      }

      // Remove the entry
      logEntries.splice(index, 1);

      logger.info(`Deleted log entry: ${logName}, ID: ${logId}`);
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

      logger.info(`Retrieved ${sortedEntries.length} entries for log: ${logName}`);
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

      logger.info(`Retrieved ${limitedLogNames.length} log names`);
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
      // Check if the log exists
      if (!this.logs.has(logName)) {
        logger.info(`Log not found: ${logName}`);
        return false;
      }

      // Clear the log
      this.logs.delete(logName);

      logger.info(`Cleared log: ${logName}`);
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
      const logNames = await this.getLogNames();

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
}
