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
 * Per-task summaries look like:
 *   ... prompt eval time = 15420.59 ms / 6592 tokens (2.34 ms per token, 427.48 tokens per second)
 *   ... eval time = 8145.54 ms / 64 tokens (129.29 ms per token, 7.73 tokens per second)
 *   ... draft acceptance = 0.57971 (40 accepted / 69 generated), mean len = 2.74
 *
 * NOTE: "prompt eval time" lines contain the substring "eval time", so the
 * prompt pattern must always be tested first.
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

const LOG_ROOT_ENV = path.join(
    process.env.USERPROFILE || '',
    '.lmstudio', 'apps', 'bionic', 'server-logs'
);
const SAMPLE_ROOT = path.join(__dirname, '..', 'sample log');

const TIMESTAMP_RE = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\]/;
const FILE_DATE_RE = /^(\d{4}-\d{2}-\d{2})/;
const MODEL_RE = /loading model\s+'([^']+?)'/;
const MMPROJ_RE = /loaded multimodal model,\s*'([^']+?)'/;
const MODEL_LOADED_RE = /model loaded/;
const LISTEN_RE = /listening on https?:\/\/[^:]+:(\d+)/;
const INIT_RE = /n_slots\s*=\s*(\d+),\s*n_ctx_slot\s*=\s*(\d+)/;
const THREADS_RE = /n_threads\s*=\s*(\d+)/;
// "prompt eval time = 15420.59 ms /  6592 tokens (    2.34 ms per token,   427.48 tokens per second)"
const PROMPT_EVAL_RE = /prompt eval time =\s*([\d.]+)\s*ms\s+\/\s*(\d+) tokens \(.*?([\d.]+) tokens per second/;
// "       eval time =    8145.54 ms /    64 tokens (  129.29 ms per token,     7.73 tokens per second)"
const GEN_EVAL_RE = /(?<![a-z])eval time =\s*([\d.]+)\s*ms\s+\/\s*(\d+) tokens \(.*?([\d.]+) tokens per second/;
const DRAFT_RE = /draft acceptance = ([\d.]+)\s*\(\s*(\d+)\s*accepted\s+\/\s*(\d+)\s*generated\s*\),\s*mean len\s*=\s*([\d.]+)/;
const TRUNCATED_RE = /truncated = (\d)/;
const TASK_START_RE = /processing task, is_child = \d/;
const TASK_END_RE = /stop processing:/;
const WARN_RE = /\bW\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.+)/;
const ERROR_RE = /\[ERROR\](?:\[([^\]]+)\])?\s*(.+)/;

// Per-file cache so repeated refreshes don't re-read unchanged logs.
const fileCache = new Map();

// How many health events to keep per file (newest kept, see parseTextToData).
const MAX_EVENTS_PER_FILE = 400;
const MAX_EVENT_MESSAGE = 240;

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

function parseTs(ts) {
    if (!ts) return null;
    const m = String(ts).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

/**
 * Turn raw log text into structured data:
 *   {
 *     tasks:    [{ model, ts, promptTps, promptTokens, genTps, genTokens,
 *                  draftAcceptance, draftAccepted, draftGenerated, draftMeanLen,
 *                  truncated }],
 *     sessions: [{ model, startTs, endTs, loadSeconds, ctx, slots, threads,
 *                  vision, port }],
 *     events:   [{ ts, level: 'warn'|'error', model, message }]
 *   }
 *
 * A "task" is one prompt+generation job (a print_timing block). Prompt and
 * generation throughput are tracked separately because they differ by an
 * order of magnitude and mean different things.
 */
function parseTextToData(text) {
    const tasks = [];
    const sessions = [];
    const events = [];

    let lastTs = null;          // wall-clock of the last prefixed line
    let session = null;         // current model session (loading model -> model loaded)
    let task = null;            // in-flight task accumulator
    let currentModel = null;    // most recent loaded model (leaf name)

    const flushTask = () => {
        if (!task) return;
        const t = task;
        task = null;
        // Only keep tasks that actually produced a measurable summary.
        if (t.promptTps === null && t.genTps === null) return;
        tasks.push(t);
    };

    const newTask = (ts) => {
        flushTask();
        task = {
            model: currentModel,
            ts: ts || lastTs,
            promptTps: null,
            promptTokens: 0,
            genTps: null,
            genTokens: 0,
            draftAcceptance: null,
            draftAccepted: 0,
            draftGenerated: 0,
            draftMeanLen: null,
            truncated: false,
        };
    };

    const pushEvent = (level, model, message) => {
        events.push({
            ts: lastTs,
            level,
            model: model || null,
            message: String(message || '').replace(/\s+/g, ' ').trim().slice(0, MAX_EVENT_MESSAGE),
        });
    };

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const tsMatch = line.match(TIMESTAMP_RE);
        if (tsMatch) lastTs = `${tsMatch[1]} ${tsMatch[2]}`;

        // --- session / model lifecycle -----------------------------------
        const mMatch = line.match(MODEL_RE);
        if (mMatch) {
            flushTask();
            currentModel = leafName(mMatch[1]);
            session = {
                model: currentModel,
                startTs: lastTs,
                endTs: null,
                loadSeconds: null,
                ctx: null,
                slots: null,
                threads: null,
                vision: false,
                port: null,
            };
            sessions.push(session);
            continue;
        }

        if (MODEL_LOADED_RE.test(line) && session && !session.endTs) {
            session.endTs = lastTs;
            const a = parseTs(session.startTs);
            const b = parseTs(session.endTs);
            if (a !== null && b !== null) {
                session.loadSeconds = Math.max(0, Math.round((b - a) / 10) / 100);
            }
            continue;
        }

        if (session) {
            if (MMPROJ_RE.test(line)) session.vision = true;
            const init = line.match(INIT_RE);
            if (init) {
                session.slots = parseInt(init[1], 10);
                session.ctx = parseInt(init[2], 10);
            }
            const threads = line.match(THREADS_RE);
            if (threads) session.threads = parseInt(threads[1], 10);
            const port = line.match(LISTEN_RE);
            if (port) session.port = parseInt(port[1], 10);
        }

        // --- task timing ---------------------------------------------------
        const prompt = line.match(PROMPT_EVAL_RE);
        if (prompt) {
            if (!task || task.promptTps !== null) newTask(lastTs);
            task.promptTps = parseFloat(prompt[3]);
            task.promptTokens = parseInt(prompt[2], 10);
            continue;
        }

        const gen = line.match(GEN_EVAL_RE);
        if (gen) {
            if (!task || task.genTps !== null) newTask(lastTs);
            task.genTps = parseFloat(gen[3]);
            task.genTokens = parseInt(gen[2], 10);
            continue;
        }

        const draft = line.match(DRAFT_RE);
        if (draft) {
            if (!task) newTask(lastTs);
            task.draftAcceptance = parseFloat(draft[1]);
            task.draftAccepted = parseInt(draft[2], 10);
            task.draftGenerated = parseInt(draft[3], 10);
            task.draftMeanLen = parseFloat(draft[4]);
            continue;
        }

        const trunc = line.match(TRUNCATED_RE);
        if (trunc) {
            if (trunc[1] === '1' && task) task.truncated = true;
        }

        if (TASK_START_RE.test(line)) { newTask(lastTs); continue; }
        if (TASK_END_RE.test(line))   { flushTask(); continue; }

        // --- health events -------------------------------------------------
        if (line.includes('[ERROR]')) {
            const e = line.match(ERROR_RE);
            pushEvent('error', e && e[1] ? e[1] : currentModel, e ? e[2] : line);
            continue;
        }
        const w = line.match(WARN_RE);
        if (w) {
            pushEvent('warn', currentModel, `${w[1]}: ${w[2]}`);
        }
    }
    flushTask();

    // Keep the newest events when a file is chatty.
    if (events.length > MAX_EVENTS_PER_FILE) {
        const events2 = events.slice(events.length - MAX_EVENTS_PER_FILE);
        return { tasks, sessions, events: events2 };
    }
    return { tasks, sessions, events };
}

/** Parsed data for a file, cached by size + mtime. */
function getDataForFile(filePath) {
    let stat;
    try { stat = fs.statSync(filePath); } catch { return { tasks: [], sessions: [], events: [] }; }
    const key = `${stat.size}:${stat.mtimeMs}`;
    const cached = fileCache.get(filePath);
    if (cached && cached.key === key) return cached.data;

    let text;
    try { text = fs.readFileSync(filePath, 'utf8'); } catch { return { tasks: [], sessions: [], events: [] }; }
    const data = parseTextToData(text);
    fileCache.set(filePath, { key, data });
    return data;
}

function mean(arr) {
    if (!arr.length) return null;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i];
    return sum / arr.length;
}

function round(v, digits = 2) {
    if (v === null || v === undefined || Number.isNaN(v)) return null;
    const f = Math.pow(10, digits);
    return Math.round(v * f) / f;
}

/**
 * Aggregate tasks/sessions/events into the dashboard payload.
 * @param {{ tasks: Array, sessions: Array, events: Array }} data
 * @param {number} fileCount
 */
function aggregate(data, fileCount) {
    const { tasks, sessions, events } = data;

    const byModelTasks = new Map();
    const byModelSessions = new Map();
    for (const t of tasks) {
        if (!byModelTasks.has(t.model)) byModelTasks.set(t.model, []);
        byModelTasks.get(t.model).push(t);
    }
    for (const s of sessions) {
        if (!byModelSessions.has(s.model)) byModelSessions.set(s.model, []);
        byModelSessions.get(s.model).push(s);
    }

    const models = [];
    for (const [name, modelTasks] of byModelTasks) {
        const promptVals = modelTasks.filter((t) => t.promptTps !== null).map((t) => t.promptTps);
        const genVals = modelTasks.filter((t) => t.genTps !== null).map((t) => t.genTps);

        const draftAccepted = modelTasks.reduce((a, t) => a + t.draftAccepted, 0);
        const draftGenerated = modelTasks.reduce((a, t) => a + t.draftGenerated, 0);

        const modelSessions = byModelSessions.get(name) || [];
        const loadVals = modelSessions.map((s) => s.loadSeconds).filter((v) => v !== null);

        models.push({
            name,
            tasks: modelTasks.length,
            promptTps: round(mean(promptVals)),
            promptTpsMin: round(Math.min(...promptVals)),
            promptTpsMax: round(Math.max(...promptVals)),
            genTps: round(mean(genVals)),
            genTpsMin: round(Math.min(...genVals)),
            genTpsMax: round(Math.max(...genVals)),
            promptTokens: modelTasks.reduce((a, t) => a + t.promptTokens, 0),
            genTokens: modelTasks.reduce((a, t) => a + t.genTokens, 0),
            truncated: modelTasks.filter((t) => t.truncated).length,
            vision: modelSessions.some((s) => s.vision),
            sessions: modelSessions.length,
            avgLoadSeconds: round(mean(loadVals), 1),
            draft: draftGenerated > 0
                ? {
                    acceptance: round(draftAccepted / draftGenerated, 3),
                    accepted: draftAccepted,
                    generated: draftGenerated,
                    meanLen: round(mean(modelTasks.filter((t) => t.draftMeanLen !== null).map((t) => t.draftMeanLen)), 2),
                }
                : null,
        });
    }
    // Fastest generation first — that's the number users care about most.
    models.sort((a, b) => (b.genTps ?? 0) - (a.genTps ?? 0));

    const promptAll = tasks.filter((t) => t.promptTps !== null).map((t) => t.promptTps);
    const genAll = tasks.filter((t) => t.genTps !== null).map((t) => t.genTps);

    // Newest-first event list, capped for the dashboard.
    const eventsDesc = [...events].reverse().slice(0, 150);
    const warnCount = events.filter((e) => e.level === 'warn').length;
    const errCount = events.filter((e) => e.level === 'error').length;

    // Sessions in chronological order.
    const sessionsAsc = [...sessions]
        .filter((s) => s.startTs)
        .sort((a, b) => String(a.startTs).localeCompare(String(b.startTs)));

    return {
        overall: {
            promptTps: round(mean(promptAll)),
            genTps: round(mean(genAll)),
        },
        models,
        sessions: sessionsAsc,
        health: {
            warnings: warnCount,
            errors: errCount,
            truncated: tasks.filter((t) => t.truncated).length,
            recent: eventsDesc,
        },
        stats: {
            totalLogFiles: fileCount,
            modelsDetected: models.length,
            totalTasks: tasks.length,
            totalPromptTokens: tasks.reduce((a, t) => a + t.promptTokens, 0),
            totalGenTokens: tasks.reduce((a, t) => a + t.genTokens, 0),
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

    const tasks = [];
    const sessions = [];
    const events = [];
    const perFile = [];

    for (const f of files) {
        const d = getDataForFile(f.path);
        tasks.push(...d.tasks);
        sessions.push(...d.sessions);
        events.push(...d.events);
        perFile.push({
            name: path.relative(root, f.path) || f.name,
            tasks: d.tasks.length,
        });
    }

    const data = aggregate({ tasks, sessions, events }, files.length);
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
 * Incrementally parse a stream of new log lines (live tailing).
 * Returns { samples, model, events } where:
 *   samples: completed tasks [{ ts, model, tps (gen tok/s), promptTps }]
 *   model:   newly loaded model name (leaf) if one appeared in this chunk
 *   events:  [{ ts, level, model, message }]
 */
function parseLiveLines(lines) {
    const samples = [];
    const events = [];
    let newModel = null;
    let currentModel = null;
    let lastTs = null;
    let task = null;

    const flush = () => {
        if (!task) return;
        const t = task;
        task = null;
        if (t.promptTps === null && t.genTps === null) return;
        samples.push({
            ts: t.ts,
            model: t.model,
            tps: t.genTps,          // primary live metric: generation tok/s
            promptTps: t.promptTps, // may be null for generation-only tasks
        });
    };

    for (const line of lines) {
        if (!line) continue;
        const tsMatch = line.match(TIMESTAMP_RE);
        if (tsMatch) lastTs = `${tsMatch[1]} ${tsMatch[2]}`;

        const mMatch = line.match(MODEL_RE);
        if (mMatch) {
            flush();
            currentModel = leafName(mMatch[1]);
            newModel = currentModel;
            task = null;
            continue;
        }

        const prompt = line.match(PROMPT_EVAL_RE);
        if (prompt) {
            if (!task || task.promptTps !== null) {
                flush();
                task = { model: currentModel, ts: lastTs, promptTps: null, genTps: null };
            }
            task.promptTps = parseFloat(prompt[3]);
            continue;
        }

        const gen = line.match(GEN_EVAL_RE);
        if (gen) {
            if (!task || task.genTps !== null) {
                flush();
                task = { model: currentModel, ts: lastTs, promptTps: null, genTps: null };
            }
            task.genTps = parseFloat(gen[3]);
            continue;
        }

        if (TASK_START_RE.test(line)) { flush(); task = { model: currentModel, ts: lastTs, promptTps: null, genTps: null }; continue; }
        if (TASK_END_RE.test(line)) { flush(); continue; }

        if (line.includes('[ERROR]')) {
            const e = line.match(ERROR_RE);
            events.push({ ts: lastTs, level: 'error', model: currentModel, message: (e ? e[2] : line).slice(0, MAX_EVENT_MESSAGE) });
            continue;
        }
        const w = line.match(WARN_RE);
        if (w) events.push({ ts: lastTs, level: 'warn', model: currentModel, message: `${w[1]}: ${w[2]}`.slice(0, MAX_EVENT_MESSAGE) });
    }
    flush();

    return { samples, model: newModel, events };
}

/**
 * Trailing task samples from a file for seeding the live chart.
 * Reads a bounded tail and returns up to `maxSamples` most recent tasks.
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

    const tasks = parseTextToData(text).tasks;
    return tasks.slice(-maxSamples).map((t) => ({
        ts: t.ts,
        model: t.model,
        tps: t.genTps,
        promptTps: t.promptTps,
    }));
}

module.exports = {
    getLogRoot,
    listLogFiles,
    listDates,
    parseTextToData,
    getDataForFile,
    aggregate,
    getPerformanceData,
    findActiveLogFile,
    readNewLines,
    parseLiveLines,
    readTailSamples,
};