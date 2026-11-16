'use strict';
let httpServer = null; // reference to the underlying HTTP server instance

/* =========================================================================
 * server.js — Local LLM Performance Monitor
 *
 * Express server that serves the dashboard and exposes the log data.
 * It parses the raw LM Studio logs itself (see logParser.js) — it does NOT
 * run the PowerShell/bat and does NOT read the generated .txt reports.
 *
 * Endpoints:
 *   GET /api/dates                -> available log dates (newest first)
 *   GET /api/performance-data     -> metrics, optionally ?date=YYYY-MM-DD
 *   GET /api/live                 -> Server-Sent Events live throughput feed
 * ========================================================================= */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger');

const {
    getLogRoot,
    listDates,
    getPerformanceData,
    findActiveLogFile,
    readNewLines,
    parseLiveLines,
    readTailSamples,
} = require('./logParser');

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Main dashboard page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).send('Dashboard not found');
});

// Available log dates for the filter dropdown
app.get('/api/dates', async (req, res, next) => {
    try {
        const data = { logRoot: getLogRoot(), dates: listDates() };
        res.json(data);
    } catch (err) {
        logger.warn(`Error listing log dates: ${err.message}`);
        next({ status: 500, message: 'Failed to list log dates' });
    }
});

// Metrics for a date (or all logs when no date is given)
app.get('/api/performance-data', async (req, res, next) => {
    try {
        const rawDate = typeof req.query.date === 'string' ? req.query.date.trim() : null;
        let dateParam = null;
        if (rawDate !== null && rawDate !== '') {
            // Validate YYYY-MM-DD format and calendar validity
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(rawDate)) {
                return res.status(400).json({ error: 'Invalid date format', details: rawDate });
            }
            // Further check for real calendar dates
            const [year, month, day] = rawDate.split('-').map(Number);
            const dt = new Date(Date.UTC(year, month - 1, day));
            if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) {
                return res.status(400).json({ error: 'Invalid calendar date', details: rawDate });
            }
            dateParam = rawDate;
        }

        const data = getPerformanceData({ date: dateParam });
        res.json({ timestamp: new Date().toISOString(), ...data });
    } catch (err) {
        logger.warn(`Error parsing logs: ${err.message}`);
        next({ status: 500, message: 'Failed to parse logs' });
    }
});

// Live throughput feed (Server-Sent Events)
const LIVE_POLL_MS = 1000;
const LIVE_HISTORY_MS = 5 * 60 * 1000; // seed with ~5 min of history
const LIVE_MAX_SAMPLES = 240;


// Track active SSE clients and their polling intervals
// Track active SSE clients and their polling intervals
const liveClients = new Set(); // set of response objects
const clientIntervals = new Map(); // res -> {poll, keepalive}


app.get('/api/live', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    // Register client
    liveClients.add(res);

    let activeFile = findActiveLogFile();
    let offset = 0;
    if (activeFile) {
        try { offset = fs.statSync(activeFile).size; } catch { offset = 0; }
    }

    const cleanUpClient = () => {
        const intervals = clientIntervals.get(res);
        if (intervals){
            clearInterval(intervals.poll);
            clearInterval(intervals.keepalive);
        }
        clientIntervals.delete(res);
        liveClients.delete(res);
    };

    const send = (event, data) => {
        if (res.writableEnded) return;
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
        catch (e){
            logger.warn(`SSE write error: ${e.message}`);
            cleanUpClient();
        }
    };

    // Initial state + trailing history so the chart isn't empty on load.
    let history = [];
    if (activeFile) {
        try { history = readTailSamples(activeFile, 1024 * 1024, LIVE_MAX_SAMPLES); } catch { history = []; }
        history = history.filter((s) => recentWithin(s, LIVE_HISTORY_MS));
    }
    send('init', {
        file: activeFile,
        history,
        model: history.length ? history[history.length - 1].model : null,
        now: Date.now(),
    });

    const poll = setInterval(() => {
        // Detect log rotation (a newer file became the active one).
        const latest = findActiveLogFile();
        if (latest && latest !== activeFile) {
            activeFile = latest;
            try { offset = fs.statSync(activeFile).size; } catch { offset = 0; }
            send('meta', { file: activeFile, rotated: true });
            return;
        }
        if (!activeFile) return;

        let stat;
        try { stat = fs.statSync(activeFile); } catch { return; }
        if (stat.size < offset) offset = 0; // truncated
        if (stat.size === offset) return;   // nothing new

        let chunk;
        try {
            chunk = readNewLines(activeFile, offset, stat.size);
        } catch { return; }
        offset = chunk.nextOffset;
        if (!chunk.lines.length) return;

        const { samples, model, events } = parseLiveLines(chunk.lines);
        if (model) send('model', { model, at: new Date().toISOString() });
        if (events.length) send('events', { events });
        if (samples.length) for (const s of samples) send('sample', s);
    }, LIVE_POLL_MS);

    // Keep‑alive ping to prevent idle timeouts
    const keepalive = setInterval(() => {
        if (!res.writableEnded) res.write(': ping\n\n');
    }, 15000);

    // Store intervals for cleanup
    clientIntervals.set(res, {poll, keepalive});

    req.on('close', () => {
        const intervals = clientIntervals.get(res);
        if (intervals){
            clearInterval(intervals.poll);
            clearInterval(intervals.keepalive);
        }
        clientIntervals.delete(res);
        liveClients.delete(res);    });
});

function recentWithin(sample, windowMs) {
    if (!sample.ts) return true;
    const m = sample.ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return true;
    const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    return (Date.now() - t) <= windowMs;
}

// Simple health check
app.get('/api/health', async (req, res, next) => {
    try {
        res.json({ ok: true, logRoot: getLogRoot() });
    } catch (err) {
        logger.warn(`Health endpoint error: ${err.message}`);
        next({ status: 500, message: 'Health check failed' });
    }
});

if (require.main === module) {
    httpServer = app.listen(PORT, () => {
        console.log(`LLM Performance Monitor running on http://localhost:${PORT}`);
        console.log(`Log root: ${getLogRoot()}`);
    });

    let shuttingDown = false;
    const gracefulShutdown = () => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log('Graceful shutdown initiated...');
        // Stop accepting new connections
        httpServer.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
        // Clean up SSE clients
        for (const [res, intervals] of clientIntervals) {
            clearInterval(intervals.poll);
            clearInterval(intervals.keepalive);
            try { res.end(); } catch (_) {}
        }
    };
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
}


app.getLiveClientCount = () => liveClients.size;

// Centralised error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`, err);
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json({ error: message });
});

module.exports = app;
