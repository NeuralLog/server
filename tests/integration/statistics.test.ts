import { StorageAdapter } from '../../src/storage/StorageAdapter';
import { MemoryStorageAdapter } from '../../src/storage/MemoryStorageAdapter';
import { NeDBStorageAdapter } from '../../src/storage/NeDBStorageAdapter';
import { RedisStorageAdapter } from '../../src/storage/RedisStorageAdapter';
import { LogEntry, AggregateStatistics, LogStatistics } from '@neurallog/shared';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const rmdir = promisify(fs.rm);

// Test data
const testLogName = 'test-statistics-log';
const testLogEntries = [
  { data: { message: 'Test message 1', status: 'success' } },
  { data: { message: 'Test message 2', status: 'error' } },
  { data: { message: 'Test message 3', status: 'success' } }
];

// Helper function to create a log with multiple entries
async function createTestLog(adapter: StorageAdapter) {
  // Store multiple log entries
  for (const entry of testLogEntries) {
    const logId = uuidv4();
    await adapter.storeLogEntry(logId, testLogName, entry.data);
  }
}

// The main test that will be reused for all storage types
async function testStatistics(adapter: StorageAdapter) {
  // Create a test log with multiple entries
  await createTestLog(adapter);

  // Get aggregate statistics
  const aggregateStats = await adapter.getAggregateStatistics();

  // Verify aggregate statistics
  expect(aggregateStats).toBeDefined();
  expect(aggregateStats.totalLogs).toBeGreaterThanOrEqual(0);
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

  // Clear the test log
  await adapter.clearLog(testLogName);
}

// Test suite for Memory storage
describe('Statistics with Memory Storage', () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter('test-namespace');
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('should track and retrieve statistics correctly', async () => {
    await testStatistics(adapter);
  });
});

// Test suite for NeDB storage
describe('Statistics with NeDB Storage', () => {
  let adapter: NeDBStorageAdapter;
  const testDbPath = path.join(__dirname, '../../data/test-nedb');

  beforeEach(async () => {
    // Ensure test directory exists
    if (!fs.existsSync(testDbPath)) {
      fs.mkdirSync(testDbPath, { recursive: true });
    }

    adapter = new NeDBStorageAdapter('test-namespace', testDbPath);
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();

    // Clean up test database files
    try {
      await rmdir(testDbPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error cleaning up test database: ${error}`);
    }
  });

  it('should track and retrieve statistics correctly', async () => {
    await testStatistics(adapter);
  });
});

// Redis storage is tested in redis-statistics.test.ts
