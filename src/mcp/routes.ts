import express from 'express';
import {
  overwriteLog,
  appendToLog,
  getLogByName,
  getLogs,
  clearLog,
  getLogEntryById,
  updateLogEntryById,
  deleteLogEntryById,
  searchLogs
} from './controllers/logsController';

const router = express.Router();

// Logs endpoints
router.post('/logs/:logName', overwriteLog); // Overwrite a log (clear and add new entries)
router.patch('/logs/:logName', appendToLog); // Append to a log
router.get('/logs/:logName', getLogByName); // Get a log by name
router.get('/logs', getLogs); // Get all logs
router.delete('/logs/:logName', clearLog); // Clear a log
router.get('/search', searchLogs); // Search logs

// Log entry endpoints
router.get('/logs/:logName/:logId', getLogEntryById); // Get a log entry by ID
router.post('/logs/:logName/:logId', updateLogEntryById); // Update a log entry by ID
router.delete('/logs/:logName/:logId', deleteLogEntryById); // Delete a log entry by ID

export default router;
