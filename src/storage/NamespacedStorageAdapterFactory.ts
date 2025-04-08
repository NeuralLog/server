import { StorageAdapter } from './StorageAdapter';
import { StorageAdapterFactory, StorageAdapterFactoryOptions } from './StorageAdapterFactory';
import logger from '../utils/logger';

/**
 * Factory for creating and caching namespace-specific storage adapters
 */
export class NamespacedStorageAdapterFactory {
  // Cache of storage adapters by namespace
  private static adapters: Map<string, StorageAdapter> = new Map();
  
  // Default namespace
  private static readonly DEFAULT_NAMESPACE = 'default';
  
  /**
   * Get a storage adapter for a specific namespace
   * 
   * @param namespace Namespace for the storage adapter
   * @param options Storage adapter factory options
   * @returns Storage adapter for the specified namespace
   */
  public static getAdapter(namespace: string = this.DEFAULT_NAMESPACE, options: StorageAdapterFactoryOptions = {}): StorageAdapter {
    // Check if we already have an adapter for this namespace
    if (this.adapters.has(namespace)) {
      return this.adapters.get(namespace)!;
    }
    
    // Create a new adapter for this namespace
    logger.info(`Creating new storage adapter for namespace: ${namespace}`);
    const adapter = StorageAdapterFactory.createAdapter(namespace, options);
    
    // Initialize the adapter
    adapter.initialize().catch(error => {
      logger.error(`Error initializing storage adapter for namespace ${namespace}: ${error instanceof Error ? error.message : String(error)}`);
    });
    
    // Cache the adapter
    this.adapters.set(namespace, adapter);
    
    return adapter;
  }
  
  /**
   * Close all adapters and clear the cache
   */
  public static async closeAll(): Promise<void> {
    // Close all adapters
    for (const [namespace, adapter] of this.adapters.entries()) {
      try {
        await adapter.close();
        logger.info(`Closed storage adapter for namespace: ${namespace}`);
      } catch (error) {
        logger.error(`Error closing storage adapter for namespace ${namespace}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Clear the cache
    this.adapters.clear();
  }
}
