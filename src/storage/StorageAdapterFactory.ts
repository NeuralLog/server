import { StorageAdapter } from './StorageAdapter';
import { MemoryStorageAdapter } from './MemoryStorageAdapter';
import { NeDBStorageAdapter } from './NeDBStorageAdapter';
import { RedisStorageAdapter, RedisOptions } from './RedisStorageAdapter';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';

/**
 * Storage adapter factory options
 */
export interface StorageAdapterFactoryOptions {
  /**
   * Storage type
   */
  type?: 'memory' | 'nedb' | 'redis';

  /**
   * Path to the database directory (for persistent storage)
   */
  dbPath?: string;

  /**
   * Whether to use in-memory storage only
   */
  inMemoryOnly?: boolean;

  /**
   * Redis connection options (for Redis storage)
   */
  redis?: RedisOptions;

  /**
   * Default namespace for logical isolation of data
   */
  namespace?: string;
}

/**
 * Storage adapter factory
 */
export class StorageAdapterFactory {
  /**
   * Create a storage adapter
   *
   * @param options Storage adapter factory options
   * @returns Storage adapter
   */
  public static createAdapter(options: StorageAdapterFactoryOptions = {}): StorageAdapter {
    const adapter = this.createAdapterInstance(options);

    // Initialize with namespace if provided
    if (options.namespace) {
      adapter.initialize(options.namespace).catch(error => {
        logger.error(`Error initializing storage adapter with namespace: ${error instanceof Error ? error.message : String(error)}`);
      });
    }

    return adapter;
  }

  /**
   * Create a storage adapter instance based on options
   *
   * @param options Storage adapter factory options
   * @returns Storage adapter instance
   */
  private static createAdapterInstance(options: StorageAdapterFactoryOptions = {}): StorageAdapter {
    // If Redis is specified, use Redis storage
    if (options.type === 'redis') {
      logger.info('Using Redis storage');
      return new RedisStorageAdapter(options.redis);
    }

    // If in-memory only, use memory storage
    if (options.inMemoryOnly || options.type === 'memory') {
      logger.info('Using in-memory storage');
      return new MemoryStorageAdapter();
    }

    // If NeDB is specified and we have a db path
    if (options.type === 'nedb' && options.dbPath) {
      // Create the database directory if it doesn't exist
      try {
        if (!fs.existsSync(options.dbPath)) {
          fs.mkdirSync(options.dbPath, { recursive: true });
        }

        logger.info(`Using NeDB storage at ${options.dbPath}`);
        return new NeDBStorageAdapter(options.dbPath);
      } catch (error) {
        logger.error(`Error creating database directory: ${error instanceof Error ? error.message : String(error)}`);
        logger.info('Falling back to in-memory storage');
        return new MemoryStorageAdapter();
      }
    }

    // Default to in-memory storage
    logger.info('No specific storage type configured, using in-memory storage');
    return new MemoryStorageAdapter();
  }
}
