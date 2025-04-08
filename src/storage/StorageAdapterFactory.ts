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
}

/**
 * Storage adapter factory
 */
export class StorageAdapterFactory {
  /**
   * Create a storage adapter for a specific namespace
   *
   * @param namespace Namespace for the storage adapter
   * @param options Storage adapter factory options
   * @returns Storage adapter
   */
  public static createAdapter(namespace: string, options: StorageAdapterFactoryOptions = {}): StorageAdapter {
    // If Redis is specified, use Redis storage
    if (options.type === 'redis') {
      logger.info(`Creating Redis storage adapter for namespace: ${namespace}`);
      return new RedisStorageAdapter(namespace, options.redis);
    }

    // If in-memory only, use memory storage
    if (options.inMemoryOnly || options.type === 'memory') {
      logger.info(`Creating in-memory storage adapter for namespace: ${namespace}`);
      return new MemoryStorageAdapter(namespace);
    }

    // If NeDB is specified and we have a db path
    if (options.type === 'nedb' && options.dbPath) {
      // Create the database directory if it doesn't exist
      try {
        if (!fs.existsSync(options.dbPath)) {
          fs.mkdirSync(options.dbPath, { recursive: true });
        }

        // Create a namespace-specific directory
        const namespacePath = path.join(options.dbPath, namespace);
        if (!fs.existsSync(namespacePath)) {
          fs.mkdirSync(namespacePath, { recursive: true });
        }

        logger.info(`Creating NeDB storage adapter for namespace: ${namespace} at ${namespacePath}`);
        return new NeDBStorageAdapter(namespace, namespacePath);
      } catch (error) {
        logger.error(`Error creating database directory: ${error instanceof Error ? error.message : String(error)}`);
        logger.info(`Falling back to in-memory storage for namespace: ${namespace}`);
        return new MemoryStorageAdapter(namespace);
      }
    }

    // Default to in-memory storage
    logger.info(`No specific storage type configured, using in-memory storage for namespace: ${namespace}`);
    return new MemoryStorageAdapter(namespace);
  }
}
