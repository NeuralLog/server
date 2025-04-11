import { RedisStorageAdapter } from '../../src/storage/RedisStorageAdapter';
import { LogEntry, AggregateStatistics, LogStatistics } from '@neurallog/shared';
import { v4 as uuidv4 } from 'uuid';

// Test data
const testLogName = 'test-redis-statistics-log';
const testLogEntries = [
  { data: { message: 'Test message 1', status: 'success' } },
  { data: { message: 'Test message 2', status: 'error' } },
  { data: { message: 'Test message 3', status: 'success' } }
];

// Skip tests if Redis is not available
const skipIfNoRedis = () => {
  try {
    // Try to connect to Redis
    const redis = require('ioredis');
    const client = new redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379
    });

    // Ping Redis to check connection
    return client.ping().then(() => {
      client.disconnect();
      return false; // Don't skip
    }).catch(() => {
      return true; // Skip
    });
  } catch (error) {
    return true; // Skip
  }
};

describe('Redis Statistics', () => {
  let adapter: RedisStorageAdapter;
  let shouldSkip: boolean;

  beforeAll(async () => {
    shouldSkip = await skipIfNoRedis();
    if (shouldSkip) {
      console.log('Skipping Redis tests - Redis not available');
    }
  });

  beforeEach(async () => {
    if (shouldSkip) {
      return;
    }

    // Create a new adapter for each test
    adapter = new RedisStorageAdapter('test-namespace', {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379
    });

    await adapter.initialize();

    // Clear any existing test data
    await adapter.clearLog(testLogName);
  });

  afterEach(async () => {
    if (shouldSkip || !adapter) {
      return;
    }

    // Clean up
    await adapter.clearLog(testLogName);
    await adapter.close();
  });

  it('should track and retrieve statistics correctly', async () => {
    if (shouldSkip) {
      console.log('Test skipped - Redis not available');
      return;
    }

    // Store multiple log entries
    for (const entry of testLogEntries) {
      const logId = uuidv4();
      await adapter.storeLogEntry(logId, testLogName, entry.data);
    }

    // Get aggregate statistics
    const aggregateStats = await adapter.getAggregateStatistics();

    // Verify aggregate statistics
    expect(aggregateStats).toBeDefined();
    expect(aggregateStats.totalLogs).toBeGreaterThanOrEqual(1);
    expect(aggregateStats.totalEntries).toBeGreaterThanOrEqual(testLogEntries.length);

    // Find our test log in the statistics
    const testLogStats = aggregateStats.logStats.find(stat => stat.logName === testLogName);
    expect(testLogStats).toBeDefined();
    expect(testLogStats?.entryCount).toBeGreaterThanOrEqual(testLogEntries.length);

    // Get statistics for the specific log
    const logStats = await adapter.getLogStatistics(testLogName);

    // Verify log statistics
    expect(logStats).toBeDefined();
    expect(logStats?.logName).toBe(testLogName);
    expect(logStats?.entryCount).toBeGreaterThanOrEqual(testLogEntries.length);
    expect(logStats?.firstEntryTimestamp).toBeDefined();
    expect(logStats?.lastEntryTimestamp).toBeDefined();
  });

  it('should update statistics when entries are deleted', async () => {
    if (shouldSkip) {
      console.log('Test skipped - Redis not available');
      return;
    }

    // Store multiple log entries
    const logIds: string[] = [];
    for (const entry of testLogEntries) {
      const logId = uuidv4();
      logIds.push(logId);
      await adapter.storeLogEntry(logId, testLogName, entry.data);
    }

    // Get initial statistics
    const initialStats = await adapter.getLogStatistics(testLogName);
    expect(initialStats?.entryCount).toBe(testLogEntries.length);

    // Delete one entry
    await adapter.deleteLogEntryById(testLogName, logIds[0]);

    // Get updated statistics
    const updatedStats = await adapter.getLogStatistics(testLogName);
    expect(updatedStats?.entryCount).toBe(testLogEntries.length - 1);

    // Delete all remaining entries
    for (let i = 1; i < logIds.length; i++) {
      await adapter.deleteLogEntryById(testLogName, logIds[i]);
    }

    // Get final statistics
    const finalStats = await adapter.getLogStatistics(testLogName);
    expect(finalStats).toBeNull(); // Log should be removed from statistics
  });

  it('should update statistics when entries are updated', async () => {
    if (shouldSkip) {
      console.log('Test skipped - Redis not available');
      return;
    }

    // Store a log entry
    const logId = uuidv4();
    await adapter.storeLogEntry(logId, testLogName, { message: 'Original message' });

    // Get initial statistics
    const initialStats = await adapter.getLogStatistics(testLogName);
    expect(initialStats?.entryCount).toBe(1);
    const initialTimestamp = initialStats?.lastEntryTimestamp;

    // Wait a moment to ensure timestamp will be different
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update the entry
    await adapter.updateLogEntryById(testLogName, logId, { message: 'Updated message' });

    // Get updated statistics
    const updatedStats = await adapter.getLogStatistics(testLogName);
    expect(updatedStats?.entryCount).toBe(1);
    expect(updatedStats?.lastEntryTimestamp).not.toBe(initialTimestamp);
  });
});
