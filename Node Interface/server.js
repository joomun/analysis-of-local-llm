'use strict';

/* =========================================================================
 * server.js — Local LLM Performance Monitor (Refactored)
 *
 * Express server that serves the dashboard and exposes the log data.
 * It parses the raw LM Studio logs itself (see logParser.js) — it does NOT
 * run the PowerShell/bat and does NOT read the generated .txt reports.
 *
 * Endpoints:
 *   GET /api/dates                -> available log dates (newest first)
 *   GET /api/performance-data     -> metrics, optionally ?date=YYYY-MM-DD
 *   GET /api/live                 -> Server-Sent Events live throughput feed
 *   GET /api/homepage             -> homepage summary data
 *   GET /api/health               -> health check endpoint
 *
 * This is now the central entry point for all API routes.
 * ========================================================================= */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Import modular components - fix import paths
const { getLogRoot, listDates, getPerformanceData, findActiveLogFile, readNewLines, parseLiveLines, readTailSamples } = require('./parsers/logParser');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Central API routes
app.use('/api', apiRoutes);

// Main dashboard page - now serves the new central HTML file
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('Dashboard not found');
});

// Simple health check - kept for backward compatibility
app.get('/api/health', (req, res) => res.json({ ok: true, logRoot: getLogRoot() }));

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`LLM Performance Monitor running on http://localhost:${PORT}`);
        console.log(`Log root: ${getLogRoot()}`);
    });
}

module.exports = app;