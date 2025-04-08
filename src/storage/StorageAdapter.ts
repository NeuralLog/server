/**
 * Storage adapter interface for storing log entries
 */
export interface StorageAdapter {
  /**
   * Initialize the storage adapter
   *
   * @param namespace Optional namespace for logical isolation of data
   */
  initialize(namespace?: string): Promise<void>;

  /**
   * Store a log entry
   *
   * @param logId Log ID
   * @param logName Log name
   * @param logEntry Log entry
   * @param namespace Optional namespace for logical isolation of data
   */
  storeLogEntry(logId: string, logName: string, logEntry: any, namespace?: string): Promise<void>;

  /**
   * Get a log entry by ID
   *
   * @param logName Log name
   * @param logId Log ID
   * @param namespace Optional namespace for logical isolation of data
   * @returns Log entry or null if not found
   */
  getLogEntryById(logName: string, logId: string, namespace?: string): Promise<any | null>;

  /**
   * Update a log entry by ID
   *
   * @param logName Log name
   * @param logId Log ID
   * @param logEntry Log entry
   * @param namespace Optional namespace for logical isolation of data
   * @returns True if the log entry was updated, false if it didn't exist
   */
  updateLogEntryById(logName: string, logId: string, logEntry: any, namespace?: string): Promise<boolean>;

  /**
   * Delete a log entry by ID
   *
   * @param logName Log name
   * @param logId Log ID
   * @param namespace Optional namespace for logical isolation of data
   * @returns True if the log entry was deleted, false if it didn't exist
   */
  deleteLogEntryById(logName: string, logId: string, namespace?: string): Promise<boolean>;

  /**
   * Get logs by name
   *
   * @param logName Log name
   * @param limit Maximum number of logs to return
   * @param namespace Optional namespace for logical isolation of data
   * @returns Logs
   */
  getLogsByName(logName: string, limit?: number, namespace?: string): Promise<any[]>;

  /**
   * Get all log names
   *
   * @param limit Maximum number of log names to return (default: 1000)
   * @param namespace Optional namespace for logical isolation of data
   * @returns Array of log names
   */
  getLogNames(limit?: number, namespace?: string): Promise<string[]>;

  /**
   * Clear a log
   *
   * @param logName Log name
   * @param namespace Optional namespace for logical isolation of data
   * @returns True if the log was cleared, false if it didn't exist
   */
  clearLog(logName: string, namespace?: string): Promise<boolean>;

  /**
   * Close the storage adapter
   * This is used to clean up resources when the adapter is no longer needed
   */
  close(): Promise<void>;

  /**
   * Search logs based on various criteria
   *
   * @param options Search options
   * @returns Search results
   */
  searchLogs(options: {
    query?: string;
    logName?: string;
    startTime?: string;
    endTime?: string;
    fieldFilters?: Record<string, any>;
    limit?: number;
    namespace?: string;
  }): Promise<Array<{logName: string; entry: any}>>;
}
