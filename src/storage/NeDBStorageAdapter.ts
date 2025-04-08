import { StorageAdapter } from './StorageAdapter';
import Datastore from 'nedb';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

/**
 * NeDB storage adapter for storing log entries
 */
export class NeDBStorageAdapter implements StorageAdapter {
  private _logsDb: Datastore;
  private initialized: boolean = false;

  /**
   * Constructor
   *
   * @param dbPath Path to the database directory (default: './data')
   */
  constructor(private readonly dbPath: string = './data') {
    // Create the database directory if it doesn't exist
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }

    // Create the database
    this._logsDb = new Datastore({
      filename: path.join(dbPath, 'logs.db'),
      autoload: false
    });
  }

  /**
   * Get the results database name
   */
  public get resultsDb(): string {
    return 'logs';
  }

  /**
   * Initialize the adapter
   * This loads the database and creates indexes
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load the database
      await this.loadDatabase(this._logsDb);

      // Create indexes
      await this.createIndex(this._logsDb, 'id', { unique: true });
      await this.createIndex(this._logsDb, 'name', { unique: false });

      this.initialized = true;
    } catch (error) {
      logger.error(`Error initializing NeDBStorageAdapter: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }



  /**
   * Store a log entry
   *
   * @param logId Log ID
   * @param logName Log name
   * @param logEntry Log entry
   */
  public async storeLogEntry(logId: string, logName: string, logEntry: any): Promise<void> {
    await this.ensureInitialized();

    try {
      // Ensure logEntry is a proper object, not a string
      const dataToStore = typeof logEntry === 'string' ?
        this.tryParseJSON(logEntry) : logEntry;

      // Create a document with the log entry
      const document = {
        id: logId,
        name: logName,
        data: dataToStore,
        timestamp: new Date().toISOString()
      };

      // Insert the document
      await this.insert(this._logsDb, document);

      logger.info(`Stored log entry: ${logName}, ID: ${logId}`);
    } catch (error) {
      logger.error(`Error storing log entry: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Try to parse a JSON string, return the original string if parsing fails
   *
   * @param jsonString String to parse
   * @returns Parsed object or original string
   */
  private tryParseJSON(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return jsonString;
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
      // Find the log entry
      const entry = await this.findOne(this._logsDb, { name: logName, id: logId });

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
    await this.ensureInitialized();

    try {
      // Check if the log entry exists
      const existingEntry = await this.findOne(this._logsDb, { name: logName, id: logId });

      if (!existingEntry) {
        logger.info(`Log entry not found for update: ${logName}, ID: ${logId}`);
        return false;
      }

      // Update the document
      const numUpdated = await this.update(
        this._logsDb,
        { name: logName, id: logId },
        { $set: { data: logEntry, timestamp: new Date().toISOString() } }
      );

      logger.info(`Updated log entry: ${logName}, ID: ${logId}`);
      return numUpdated > 0;
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
      // Remove the document
      const numRemoved = await this.remove(this._logsDb, { name: logName, id: logId });

      if (numRemoved > 0) {
        logger.info(`Deleted log entry: ${logName}, ID: ${logId}`);
        return true;
      } else {
        logger.info(`Log entry not found for deletion: ${logName}, ID: ${logId}`);
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
   * @returns Logs
   */
  public async getLogsByName(logName: string, limit: number = 100): Promise<any[]> {
    await this.ensureInitialized();

    try {
      // Find all documents with the specified log name
      const documents = await this.find(this._logsDb, { name: logName }, { timestamp: -1 }, limit);

      logger.info(`Retrieved ${documents.length} entries for log: ${logName}`);
      return documents;
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
      // Get unique log names
      const logNames = await this.getUniqueLogNames();

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
    await this.ensureInitialized();

    try {
      // Check if the log exists
      const entries = await this.getLogsByName(logName, 1);
      if (entries.length === 0) {
        logger.info(`Log not found: ${logName}`);
        return false;
      }

      // Remove all entries with the specified log name
      const numRemoved = await this.remove(this._logsDb, { name: logName });

      logger.info(`Cleared log: ${logName}, removed ${numRemoved} entries`);
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
    // NeDB doesn't have a close method, so we just reset the initialized flag
    this.initialized = false;
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
   * Load a database
   *
   * @param db Database to load
   */
  private loadDatabase(db: Datastore): Promise<void> {
    return new Promise((resolve, reject) => {
      db.loadDatabase((err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Create an index
   *
   * @param db Database to create the index in
   * @param fieldName Field to index
   * @param options Index options
   */
  private createIndex(db: Datastore, fieldName: string, options: any): Promise<void> {
    return new Promise((resolve, reject) => {
      db.ensureIndex({ fieldName, ...options }, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Find documents
   *
   * @param db Database to search
   * @param query Query to execute
   * @param sort Sort options
   * @param limit Maximum number of documents to return
   * @returns Array of documents
   */
  /**
   * Get unique log names
   *
   * @returns Array of unique log names
   */
  private async getUniqueLogNames(): Promise<string[]> {
    try {
      // Find all documents and extract unique log names
      const documents = await this.find(this._logsDb, {});
      const logNames = new Set<string>();

      for (const doc of documents) {
        const typedDoc = doc as { name?: string };
        if (typedDoc.name) {
          logNames.add(typedDoc.name);
        }
      }

      return Array.from(logNames);
    } catch (error) {
      logger.error(`Error getting unique log names: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private find<T>(db: Datastore, query: any, sort?: any, limit?: number): Promise<T[]> {
    return new Promise((resolve, reject) => {
      let cursor = db.find(query);

      if (sort) {
        cursor = cursor.sort(sort);
      }

      if (limit) {
        cursor = cursor.limit(limit);
      }

      cursor.exec((err: Error | null, docs: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(docs as T[]);
        }
      });
    });
  }

  /**
   * Find a single document
   *
   * @param db Database to search
   * @param query Query to execute
   * @returns Document or null if not found
   */
  private findOne<T>(db: Datastore, query: any): Promise<T | null> {
    return new Promise((resolve, reject) => {
      db.findOne(query, (err: Error | null, doc: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(doc as T || null);
        }
      });
    });
  }

  /**
   * Insert a document
   *
   * @param db Database to insert into
   * @param doc Document to insert
   * @returns Inserted document
   */
  private insert<T>(db: Datastore, doc: any): Promise<T> {
    return new Promise((resolve, reject) => {
      db.insert(doc, (err: Error | null, newDoc: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(newDoc as T);
        }
      });
    });
  }

  /**
   * Update a document
   *
   * @param db Database to update
   * @param query Query to find the document
   * @param update Update to apply
   * @param options Update options
   * @returns Number of documents updated
   */
  private update(db: Datastore, query: any, update: any, options: any = {}): Promise<number> {
    return new Promise((resolve, reject) => {
      db.update(query, update, options, (err: Error | null, numAffected: number) => {
        if (err) {
          reject(err);
        } else {
          resolve(numAffected);
        }
      });
    });
  }

  /**
   * Remove documents
   *
   * @param db Database to remove from
   * @param query Query to find the documents
   * @param options Remove options
   * @returns Number of documents removed
   */
  private remove(db: Datastore, query: any, options: any = {}): Promise<number> {
    return new Promise((resolve, reject) => {
      db.remove(query, options, (err: Error | null, numRemoved: number) => {
        if (err) {
          reject(err);
        } else {
          resolve(numRemoved);
        }
      });
    });
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
    let resultCount = 0;

    try {
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
    } catch (error) {
      logger.error(`Error searching logs: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
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
