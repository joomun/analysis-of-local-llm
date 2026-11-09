'use strict';

/* =========================================================================
 * logParser.js — parse LM Studio (Bionic) server logs directly in Node.
 *
 * This is the dashboard's own data source. It reads the raw .log files
 * under the LM Studio server-logs directory and never depends on the
 * PowerShell/bat report (that stays the standalone CLI tool).
 *
 * Log layout (as produced by LM Studio Bionic):
 *   <root>/YYYY-MM/YYYY-MM-DD.N.log
 *
 * Every line is prefixed with a local timestamp:
 *   [2026-11-08 03:05:45][DEBUG] ...
 * A model is loaded with:
 *   ... load_model: loading model '<absolute/path/to/model.gguf>'
 * Throughput samples look like:
 *   ... t = 6.28 s / 326.24 tokens per second
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

const LOG_ROOT_ENV = path.join(
    process.env.USERPROFILE || '',
    '.lmstudio', 'apps', 'bionic', 'server-logs'
);
const SAMPLE_ROOT = path.join(__dirname, '..', 'sample log');

const MODEL_RE = /loading model\s+'([^']+?)'/;
const TPS_RE = /([0-9]+(?:\.[0-9]+)?)\s+tokens per second/;
const TIMESTAMP_RE = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\]/;
const FILE_DATE_RE = /^(\d{4}-\d{2}-\d{2})/;

// Per-file cache so repeated refreshes don't re-read unchanged logs.
const fileCache = new Map();

function getLogRoot() {
    if (fs.existsSync(LOG_ROOT_ENV)) return LOG_ROOT_ENV;
    if (fs.existsSync(SAMPLE_ROOT)) return SAMPLE_ROOT;
    return LOG_ROOT_ENV;
}

function leafName(p) {
    return String(p || '').split(/[\\/]/).filter(Boolean).pop() || p;
}

/**
 * List .log files, optionally filtered to a single YYYY-MM-DD date.
 * Returns an array of { path, name, date }.
 */
function listLogFiles({ date = null } = {}) {
    const root = getLogRoot();
    if (!fs.existsSync(root)) return [];

    const files = [];
    for (const month of fs.readdirSync(root)) {
        const monthPath = path.join(root, month);
        let st;
        try { st = fs.statSync(monthPath); } catch { continue; }
        if (!st.isDirectory()) continue;

        for (const name of fs.readdirSync(monthPath)) {
            if (!/\.log$/i.test(name)) continue;
            const fileDate = (name.match(FILE_DATE_RE) || [])[1] || null;
            if (date && fileDate !== date) continue;
            files.push({ path: path.join(monthPath, name), name, date: fileDate });
        }
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return files;
}

/** Unique log dates (YYYY-MM-DD), newest first. */
function listDates() {
    const set = new Set();
    for (const f of listLogFiles()) if (f.date) set.add(f.date);
    return [...set].sort().reverse();
}

/**
 * Turn raw log text into a flat array of throughput samples:
 *   { model, tps, ts }  where ts is "YYYY-MM-DD HH:MM:SS" or null.
 * A sample is attributed to the most recently loaded model.
 */
function parseTextToSamples(text) {
    const samples = [];
    let currentModel = null;
    // Log lines are chronological, and a single print_timing block spans several
    // lines where only some carry a wall-clock [date time] prefix (the per-batch
    // "eval time" line does not). Carry the last seen timestamp forward so every
    // sample still gets a usable time for the time-series chart.
    let lastTs = null;
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const tsMatch = line.match(TIMESTAMP_RE);
        if (tsMatch) lastTs = `${tsMatch[1]} ${tsMatch[2]}`;

        const mMatch = line.match(MODEL_RE);
        if (mMatch) {
            currentModel = leafName(mMatch[1]);
            continue;
        }

        const tMatch = line.match(TPS_RE);
        if (tMatch && currentModel) {
            samples.push({
                model: currentModel,
                tps: parseFloat(tMatch[1]),
                ts: lastTs,
            });
        }
    }
    return samples;
}

/** Parsed samples for a file, cached by size + mtime. */
function getSamplesForFile(filePath) {
    let stat;
    try { stat = fs.statSync(filePath); } catch { return []; }
    const key = `${stat.size}:${stat.mtimeMs}`;
    const cached = fileCache.get(filePath);
    if (cached && cached.key === key) return cached.samples;

    let text;
    try { text = fs.readFileSync(filePath, 'utf8'); } catch { return []; }
    const samples = parseTextToSamples(text);
    fileCache.set(filePath, { key, samples });
    return samples;
}

function mean(arr) {
    if (!arr.length) return null;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
}

/** Aggregate flat samples into per-model + overall metrics. */
function aggregate(samples, fileCount) {
    const byModel = new Map();
    const allValues = [];

    for (const s of samples) {
        if (!byModel.has(s.model)) byModel.set(s.model, []);
        byModel.get(s.model).push(s.tps);
        allValues.push(s.tps);
    }

    const models = [];
    for (const [name, values] of byModel) {
        models.push({
            name,
            tokensPerSec: mean(values),
            sampleCount: values.length,
        });
    }
    models.sort((a, b) => b.tokensPerSec - a.tokensPerSec);

    return {
        overallAverage: mean(allValues),
        models,
        stats: {
            totalLogFiles: fileCount,
            modelsDetected: models.length,
            totalSamples: samples.length,
        },
    };
}

/**
 * Full dashboard payload, scoped to a date or all logs.
 * @param {{ date?: string|null }} opts  date = "YYYY-MM-DD" or null for all.
 */
function getPerformanceData({ date = null } = {}) {
    const root = getLogRoot();
    const files = listLogFiles({ date });
    const samples = [];
    const perFile = [];

    for (const f of files) {
        const s = getSamplesForFile(f.path);
        samples.push(...s);
        perFile.push({
            name: path.relative(root, f.path) || f.name,
            samples: s.length,
        });
    }

    const data = aggregate(samples, files.length);
    data.scope = date || 'all';
    data.logRoot = root;

    const dates = files.map((f) => f.date).filter(Boolean).sort();
    data.stats.dateRange = dates.length
        ? { from: dates[0], to: dates[dates.length - 1] }
        : null;
    data.stats.files = perFile;
    data.dates = listDates();

    return data;
}

/** The most recently modified log file — the "active" one for live tailing. */
function findActiveLogFile() {
    const files = listLogFiles();
    if (!files.length) return null;
    let best = null;
    for (const f of files) {
        let st;
        try { st = fs.statSync(f.path); } catch { continue; }
        if (!best || st.mtimeMs > best.mtimeMs) best = { path: f.path, mtimeMs: st.mtimeMs };
    }
    return best ? best.path : null;
}

/**
 * Read newly appended bytes [offset, size) from a file. Only consumes up to
 * the last complete newline so a half-written final line is never emitted.
 * Returns { lines, nextOffset }.
 */
function readNewLines(filePath, offset, size) {
    if (size <= offset) return { lines: [], nextOffset: offset };
    const fd = fs.openSync(filePath, 'r');
    const len = size - offset;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, offset);
    fs.closeSync(fd);

    const text = buf.toString('utf8');
    const lastNl = text.lastIndexOf('\n');
    if (lastNl === -1) return { lines: [], nextOffset: offset };

    const consumedBytes = Buffer.byteLength(text.slice(0, lastNl + 1), 'utf8');
    const nextOffset = offset + consumedBytes;
    const lines = text.slice(0, lastNl + 1).split('\n').filter((l) => l.trim().length);
    return { lines, nextOffset };
}

/**
 * Trailing samples from a file for seeding a live chart.
 * Reads a bounded tail and returns up to `maxSamples` most recent samples.
 */
function readTailSamples(filePath, maxBytes = 1024 * 1024, maxSamples = 240) {
    let stat;
    try { stat = fs.statSync(filePath); } catch { return []; }
    const size = stat.size;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(filePath, 'r');
    const len = size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    fs.closeSync(fd);

    let text = buf.toString('utf8');
    if (start > 0) {
        const nl = text.indexOf('\n');
        if (nl !== -1) text = text.slice(nl + 1); // drop a possibly-partial first line
    }

    const samples = parseTextToSamples(text);
    return samples.slice(-maxSamples);
}

module.exports = {
    getLogRoot,
    listLogFiles,
    listDates,
    parseTextToSamples,
    getSamplesForFile,
    aggregate,
    getPerformanceData,
    findActiveLogFile,
    readNewLines,
    readTailSamples,
};
