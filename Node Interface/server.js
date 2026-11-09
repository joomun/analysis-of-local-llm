'use strict';

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
app.get('/api/dates', (req, res) => {
    try {
        res.json({ logRoot: getLogRoot(), dates: listDates() });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list log dates', details: err.message });
    }
});

// Metrics for a date (or all logs when no date is given)
app.get('/api/performance-data', (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date.trim() : null;
        const data = getPerformanceData({ date: date || null });
        res.json({ timestamp: new Date().toISOString(), ...data });
    } catch (err) {
        res.status(500).json({ error: 'Failed to parse logs', details: err.message });
    }
});

// Live throughput feed (Server-Sent Events)
const LIVE_POLL_MS = 1000;
const LIVE_HISTORY_MS = 5 * 60 * 1000; // seed with ~5 min of history
const LIVE_MAX_SAMPLES = 240;

app.get('/api/live', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    let activeFile = findActiveLogFile();
    let offset = 0;
    if (activeFile) {
        try { offset = fs.statSync(activeFile).size; } catch { offset = 0; }
    }

    const send = (event, data) => {
        if (res.writableEnded) return;
        try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
        catch { /* socket already gone */ }
    };

    // Initial state + trailing history so the chart isn't empty on load.
    let history = [];
    if (activeFile) {
        try { history = readTailSamples(activeFile, 1024 * 1024, LIVE_MAX_SAMPLES); } catch { history = []; }
        // keep only the recent window
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

    const keepalive = setInterval(() => {
        if (!res.writableEnded) res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
        clearInterval(poll);
        clearInterval(keepalive);
    });
});

function recentWithin(sample, windowMs) {
    if (!sample.ts) return true;
    const m = sample.ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return true;
    const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    return (Date.now() - t) <= windowMs;
}

// Simple health check
app.get('/api/health', (req, res) => res.json({ ok: true, logRoot: getLogRoot() }));

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`LLM Performance Monitor running on http://localhost:${PORT}`);
        console.log(`Log root: ${getLogRoot()}`);
    });
}

module.exports = app;
