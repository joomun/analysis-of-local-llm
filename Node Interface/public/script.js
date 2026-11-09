/* =========================================================================
   Local LLM Performance Monitor — frontend
   - Fetches parsed log metrics (scoped by an optional date) and renders
     stats, a bar chart, a model table, and a data-source summary.
   - Streams a live tokens/sec feed over Server-Sent Events into a rolling
     line chart so the user never has to tail the log manually.
   - Theme is driven by the `data-theme` attribute on <html> (dark / light).
   ========================================================================= */

// --- DOM references -------------------------------------------------------
const refreshBtn        = document.getElementById('refreshBtn');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const autoRefreshLabel  = document.getElementById('autoRefreshLabel');
const themeToggle       = document.getElementById('themeToggle');
const themeLabel        = document.getElementById('themeLabel');
const iconMoon          = themeToggle.querySelector('.icon-moon');
const iconSun           = themeToggle.querySelector('.icon-sun');
const lastUpdatedEl     = document.getElementById('lastUpdated');
const loadingEl         = document.getElementById('loading');
const errorEl           = document.getElementById('error');
const errorMessageEl    = document.getElementById('errorMessage');
const connStatus        = document.getElementById('connStatus');
const statusText        = document.getElementById('statusText');
const dateFilterEl      = document.getElementById('dateFilter');
const liveToggleBtn     = document.getElementById('liveToggle');
const liveToggleLabel   = document.getElementById('liveToggleLabel');

// --- State ----------------------------------------------------------------
let genChart = null;
let promptChart = null;
let autoRefreshInterval = null;
let isAutoRefreshing = false;
let lastModels = [];

const AUTO_REFRESH_MS = 5000;

// Live feed state
let liveSource = null;
let liveChart = null;
let livePaused = false;
const LIVE_MAX_POINTS = 240;
const liveLabels = [];
const liveData = [];

// --- Helpers --------------------------------------------------------------
function cssVar(name) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || null;
}

function setConnectionState(state) {
    connStatus.classList.remove('online', 'busy', 'offline');
    if (state === 'online')  { connStatus.classList.add('online');  statusText.textContent = 'online';  }
    if (state === 'busy')    { connStatus.classList.add('busy');    statusText.textContent = 'busy';    }
    if (state === 'offline') { connStatus.classList.add('offline'); statusText.textContent = 'offline'; }
}

// --- Data (historical, optionally date-scoped) ----------------------------
function fetchData({ loading = true } = {}) {
    const date = dateFilterEl ? dateFilterEl.value : '';
    setConnectionState('busy');
    hideError();
    if (loading) showLoading(true);

    const url = '/api/performance-data' + (date ? `?date=${encodeURIComponent(date)}` : '');

    fetch(url)
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then((data) => {
            updateDashboard(data);
            setConnectionState('online');
        })
        .catch((error) => {
            console.error('Fetch error:', error);
            showError(`Failed to fetch data: ${error.message}`);
            setConnectionState('offline');
        })
        .finally(() => {
            if (loading) showLoading(false);
        });
}

function updateDashboard(data) {
    const now = new Date();
    lastUpdatedEl.textContent = `updated ${now.toLocaleTimeString()}`;

    lastModels = Array.isArray(data.models) ? data.models : [];
    const stats = data.stats || {};
    const overall = data.overall || {};
    const health = data.health || {};

    const setNum = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = (value === null || value === undefined) ? 'N/A' : Number(value).toFixed(2);
    };
    setNum('overallGen', overall.genTps);
    setNum('overallPrompt', overall.promptTps);

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (value === null || value === undefined) ? '0' : value;
    };
    setText('totalTasks', stats.totalTasks);
    setText('totalGenTokens', stats.totalGenTokens);
    setText('modelsDetected', stats.modelsDetected);
    setText('warnCount', health.warnings);
    setText('errCount', health.errors);

    // Data-source summary
    const scope = data.scope === 'all' || !data.scope ? 'all dates' : data.scope;
    const scopeHintEl = document.getElementById('scopeHint');
    if (scopeHintEl) scopeHintEl.textContent = scope;
    const rootEl = document.getElementById('sourceRoot');
    if (rootEl) rootEl.textContent = data.logRoot || '—';
    const fileCountEl = document.getElementById('sourceFileCount');
    if (fileCountEl) fileCountEl.textContent = `${stats.totalLogFiles ?? 0}`;
    const rangeEl = document.getElementById('sourceRange');
    if (rangeEl) {
        rangeEl.textContent = (stats.dateRange && stats.dateRange.from)
            ? `${stats.dateRange.from} → ${stats.dateRange.to}`
            : '—';
    }
    updateSourceFiles(Array.isArray(stats.files) ? stats.files : []);

    // Table + count
    const models = Array.isArray(data.models) ? data.models : [];
    document.getElementById('modelCount').textContent =
        `${models.length} model${models.length === 1 ? '' : 's'}`;
    updateModelTable(models);

    // Bar charts (generation + prompt)
    genChart = updateBarChart('genChart', models, 'genTps', genChart);
    promptChart = updateBarChart('promptChart', models, 'promptTps', promptChart);

    // Sessions + health
    updateSessionTable(Array.isArray(data.sessions) ? data.sessions : []);
    updateEvents(health.recent || [], health.warnings || 0, health.errors || 0);
}

function updateSourceFiles(files) {
    const list = document.getElementById('sourceFiles');
    if (!list) return;
    list.innerHTML = '';

    if (!files.length) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = 'No log files found for this scope';
        list.appendChild(li);
        return;
    }

    const fragment = document.createDocumentFragment();
    files.forEach((f) => {
        const li = document.createElement('li');
        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = f.name;
        name.title = f.name;
        const count = document.createElement('span');
        count.className = 'file-count';
        const n = f.tasks ?? 0;
        count.textContent = `${n} task${n === 1 ? '' : 's'}`;
        li.append(name, count);
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
}

function fmt(v, digits = 2, suffix = '') {
    return (v === null || v === undefined) ? '—' : Number(v).toFixed(digits) + suffix;
}

function updateModelTable(models) {
    const tbody = document.getElementById('modelTableBody');
    tbody.innerHTML = '';

    if (!models || models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">No model data available</td></tr>';
        return;
    }

    const sorted = [...models].sort((a, b) => (b.genTps ?? 0) - (a.genTps ?? 0));
    const fragment = document.createDocumentFragment();

    sorted.forEach((m) => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'model-name';
        nameSpan.textContent = m.name;
        nameSpan.title = m.name;
        nameCell.appendChild(nameSpan);

        const cells = [
            fmt(m.genTps),
            fmt(m.promptTps),
            String(m.tasks ?? 0),
            m.genTokens ? m.genTokens.toLocaleString() : '—',
            m.draft ? `${(m.draft.acceptance * 100).toFixed(0)}%` : '—',
            m.avgLoadSeconds !== null ? `${m.avgLoadSeconds}s` : '—',
        ];
        cells.forEach((text) => {
            const td = document.createElement('td');
            td.className = 'num';
            td.textContent = text;
            row.appendChild(td);
        });

        const visionCell = document.createElement('td');
        if (m.vision) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-vision';
            badge.textContent = 'vision';
            badge.title = 'Multimodal projection (mmproj) loaded';
            visionCell.appendChild(badge);
        } else {
            visionCell.textContent = '—';
        }
        row.appendChild(visionCell);

        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

function updateSessionTable(sessions) {
    const tbody = document.getElementById('sessionTableBody');
    const countEl = document.getElementById('sessionCount');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (countEl) countEl.textContent = `${sessions.length} session${sessions.length === 1 ? '' : 's'}`;
    if (!sessions.length) {
        tbody.innerHTML = '<tr><td colspan="8">No sessions found for this scope</td></tr>';
        return;
    }

    // Newest first — the most recent session is usually what you care about.
    const sorted = [...sessions].reverse();
    const fragment = document.createDocumentFragment();

    sorted.forEach((s) => {
        const row = document.createElement('tr');

        const startedCell = document.createElement('td');
        startedCell.className = 'mono';
        startedCell.textContent = s.startTs ? String(s.startTs).slice(5) : '—';

        const nameCell = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'model-name';
        nameSpan.textContent = s.model || '—';
        nameSpan.title = s.model || '';
        nameCell.appendChild(nameSpan);

        const cells = [
            s.loadSeconds !== null ? `${s.loadSeconds}s` : '—',
            s.ctx ? s.ctx.toLocaleString() : '—',
            s.slots ?? '—',
            s.threads ?? '—',
            s.port ?? '—',
        ];
        cells.forEach((text) => {
            const td = document.createElement('td');
            td.className = 'num';
            td.textContent = String(text);
            row.appendChild(td);
        });

        const visionCell = document.createElement('td');
        if (s.vision) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-vision';
            badge.textContent = 'vision';
            visionCell.appendChild(badge);
        } else {
            visionCell.textContent = '—';
        }
        row.appendChild(visionCell);

        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

function updateEvents(events, warnCount, errCount) {
    const list = document.getElementById('eventsList');
    const hint = document.getElementById('healthHint');
    if (!list) return;

    if (hint) {
        hint.textContent = events.length
            ? `${warnCount} warning${warnCount === 1 ? '' : 's'} · ${errCount} error${errCount === 1 ? '' : 's'} · showing ${events.length}`
            : 'all clear';
    }

    list.innerHTML = '';
    if (!events.length) {
        const empty = document.createElement('div');
        empty.className = 'events-empty';
        empty.textContent = 'No warnings or errors in this scope';
        list.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    events.forEach((e) => {
        const item = document.createElement('div');
        item.className = `event event-${e.level}`;

        const time = document.createElement('span');
        time.className = 'event-time';
        time.textContent = e.ts ? String(e.ts).slice(5) : '—';

        const tag = document.createElement('span');
        tag.className = 'event-tag';
        tag.textContent = e.level === 'error' ? 'ERR' : 'WARN';

        const msg = document.createElement('span');
        msg.className = 'event-msg';
        msg.textContent = e.message || '';
        msg.title = e.message || '';

        item.append(time, tag, msg);
        fragment.appendChild(item);
    });
    list.appendChild(fragment);
}

// --- Date filter ----------------------------------------------------------
function loadDates() {
    if (!dateFilterEl) return;
    fetch('/api/dates')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('dates failed'))))
        .then((payload) => {
            const dates = Array.isArray(payload.dates) ? payload.dates : [];
            const current = dateFilterEl.value;
            dateFilterEl.innerHTML = '';

            const all = document.createElement('option');
            all.value = '';
            all.textContent = 'All dates';
            dateFilterEl.appendChild(all);

            dates.forEach((d) => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                dateFilterEl.appendChild(opt);
            });

            dateFilterEl.value = current;
        })
        .catch((err) => console.warn('Could not load dates:', err.message));
}

// --- Charts ---------------------------------------------------------------
function chartColors() {
    return {
        accent:      cssVar('--accent')      || '#5eead4',
        accent2:     cssVar('--accent-2')    || '#8ba4ff',
        accent3:     cssVar('--accent-3')    || '#c58bff',
        green:       cssVar('--terminal-green') || '#7ef2b0',
        textPrimary: cssVar('--text-primary')  || '#e8eefb',
        textMuted:   cssVar('--text-muted')    || '#7a89a6',
        grid:        cssVar('--border-color')  || 'rgba(126,158,210,0.2)',
        surface:     cssVar('--surface-strong') || '#0c1320',
    };
}

/**
 * Render (or re-render) one per-model bar chart.
 * @returns {Chart|null} the new chart instance
 */
function updateBarChart(canvasId, models, field, existing) {
    const ctxEl = document.getElementById(canvasId);
    if (!ctxEl) return null;

    if (existing) existing.destroy();

    const c = chartColors();
    const barPalette = [c.accent, c.accent2, c.accent3, c.green];
    const sorted = [...models].sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0));
    const labels = sorted.map((m) => {
        const name = m.name || '';
        return name.length > 18 ? `${name.slice(0, 15)}…` : name;
    });

    return new Chart(ctxEl, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tokens per Second',
                data: sorted.map((m) => m[field] ?? null),
                backgroundColor: sorted.map((_, i) => barPalette[i % barPalette.length]),
                hoverBackgroundColor: c.accent,
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 64,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: c.surface,
                    titleColor: c.textPrimary,
                    bodyColor: c.textPrimary,
                    borderColor: c.grid,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        title: (items) => (items[0] ? items[0].label : ''),
                        label: (context) => `${Number(context.parsed.y).toFixed(2)} tokens/sec`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: c.grid },
                    border: { display: false },
                    ticks: { color: c.textMuted, font: { family: 'JetBrains Mono', size: 12 } },
                    title: { display: true, text: 'tokens / sec', color: c.textMuted, font: { family: 'JetBrains Mono', size: 11 } },
                },
                x: {
                    grid: { display: false },
                    border: { color: c.grid },
                    ticks: { color: c.textMuted, font: { family: 'JetBrains Mono', size: 10 } },
                },
            },
            animation: { duration: 700, easing: 'easeOutQuart' },
        },
    });
}

function rerenderModelCharts() {
    const models = Array.isArray(lastModels) ? lastModels : [];
    if (!models.length) return;
    genChart = updateBarChart('genChart', models, 'genTps', genChart);
    promptChart = updateBarChart('promptChart', models, 'promptTps', promptChart);
}

// --- Live feed (SSE) ------------------------------------------------------
function initLiveChart() {
    const ctxEl = document.getElementById('liveChart');
    if (!ctxEl || typeof Chart === 'undefined') return;

    if (liveChart) liveChart.destroy();
    const c = chartColors();

    liveChart = new Chart(ctxEl, {
        type: 'line',
        data: {
            labels: liveLabels,
            datasets: [{
                label: 'tokens/sec',
                data: liveData,
                borderColor: c.accent,
                backgroundColor: cssVar('--accent-soft') || 'rgba(94, 234, 212, 0.14)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: c.accent,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: c.surface,
                    titleColor: c.textPrimary,
                    bodyColor: c.textPrimary,
                    borderColor: c.grid,
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: (ctx) => `${Number(ctx.parsed.y).toFixed(2)} tokens/sec`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { color: c.grid, display: false },
                    border: { color: c.grid },
                    ticks: { color: c.textMuted, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { family: 'JetBrains Mono', size: 10 } },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: c.grid },
                    border: { display: false },
                    ticks: { color: c.textMuted, font: { family: 'JetBrains Mono', size: 11 } },
                    title: { display: true, text: 'tokens/sec', color: c.textMuted, font: { family: 'JetBrains Mono', size: 11 } },
                },
            },
        },
    });
}

function updateLiveChart() { if (liveChart) liveChart.update('none'); }

function appendLivePoint(label, value) {
    if (value === null || value === undefined) return; // prompt-only task: no gen point
    liveLabels.push(label);
    liveData.push(value);
    while (liveLabels.length > LIVE_MAX_POINTS) { liveLabels.shift(); liveData.shift(); }
    updateLiveChart();
}

function setLiveReadout(value, model, timeLabel, promptValue) {
    const cur = document.getElementById('liveCurrent');
    const promptEl = document.getElementById('livePrompt');
    const mdl = document.getElementById('liveModel');
    const last = document.getElementById('liveLast');
    if (cur)  cur.textContent = (value === null || value === undefined) ? '–' : Number(value).toFixed(2);
    if (promptEl) promptEl.textContent = (promptValue === null || promptValue === undefined) ? '–' : Number(promptValue).toFixed(2);
    if (mdl)  { mdl.textContent = model || '—'; mdl.title = model || ''; }
    if (last) last.textContent = timeLabel || '–';
}

function setLiveFile(file) {
    const el = document.getElementById('liveFile');
    if (!el) return;
    if (file) {
        el.textContent = file.split(/[\\/]/).pop();
        el.title = file;
    } else {
        el.textContent = '—';
        el.title = '';
    }
}

function setLiveBadge(state) {
    const badge = document.getElementById('liveBadge');
    const text = document.getElementById('liveBadgeText');
    if (!badge) return;
    badge.classList.remove('is-paused', 'is-error');
    if (state === 'paused') badge.classList.add('is-paused');
    if (state === 'error')  badge.classList.add('is-error');
    if (text) text.textContent = state === 'paused' ? 'PAUSED' : (state === 'error' ? 'RECONNECT' : 'LIVE');
}

function seedLive(history) {
    liveLabels.length = 0;
    liveData.length = 0;
    let idx = 0;
    for (const s of history) {
        if (s.tps === null || s.tps === undefined) continue;
        const label = s.ts ? String(s.ts).slice(11) : String(idx);
        liveLabels.push(label);
        liveData.push(Number(s.tps));
        idx++;
    }
    while (liveLabels.length > LIVE_MAX_POINTS) { liveLabels.shift(); liveData.shift(); }
    const last = history.length ? history[history.length - 1] : null;
    if (last) setLiveReadout(last.tps, last.model, last.ts ? String(last.ts).slice(11) : '–', last.promptTps);
    updateLiveChart();
}

function connectLive() {
    if (liveSource) { try { liveSource.close(); } catch (e) { /* noop */ } }
    setLiveBadge('live');

    liveSource = new EventSource('/api/live');

    liveSource.addEventListener('init', (ev) => {
        let payload;
        try { payload = JSON.parse(ev.data); } catch (e) { return; }
        setLiveFile(payload.file || null);
        if (payload.model) {
            const el = document.getElementById('liveModel');
            if (el) { el.textContent = payload.model; el.title = payload.model; }
        }
        seedLive(Array.isArray(payload.history) ? payload.history : []);
        setLiveBadge('live');
    });

    liveSource.addEventListener('sample', (ev) => {
        let s;
        try { s = JSON.parse(ev.data); } catch (e) { return; }
        const label = s.ts ? String(s.ts).slice(11) : String(liveLabels.length);
        appendLivePoint(label, Number(s.tps));
        setLiveReadout(s.tps, s.model, label, s.promptTps);
        setLiveBadge('live');
    });

    liveSource.addEventListener('model', (ev) => {
        let payload;
        try { payload = JSON.parse(ev.data); } catch (e) { return; }
        if (!payload.model) return;
        const el = document.getElementById('liveModel');
        if (el) { el.textContent = payload.model; el.title = payload.model; }
    });

    liveSource.addEventListener('events', (ev) => {
        // Live warnings/errors: surface them in the console for now — they
        // also accumulate in the Health panel on the next refresh.
        let payload;
        try { payload = JSON.parse(ev.data); } catch (e) { return; }
        (payload.events || []).forEach((e) => {
            console.warn(`[${e.level}] ${e.message || ''}`);
        });
    });

    liveSource.addEventListener('meta', (ev) => {
        let payload;
        try { payload = JSON.parse(ev.data); } catch (e) { return; }
        if (payload.file) setLiveFile(payload.file);
        if (payload.rotated) seedLive([]); // a new day's log became active
    });

    liveSource.onopen = () => { if (!livePaused) setLiveBadge('live'); };
    liveSource.onerror = () => { if (!livePaused) setLiveBadge('error'); };
}

function disconnectLive() {
    if (liveSource) { try { liveSource.close(); } catch (e) { /* noop */ } liveSource = null; }
}

function toggleLive() {
    livePaused = !livePaused;
    if (livePaused) {
        disconnectLive();
        setLiveBadge('paused');
        if (liveToggleLabel) liveToggleLabel.textContent = 'Resume';
        if (liveToggleBtn) liveToggleBtn.setAttribute('aria-pressed', 'false');
    } else {
        connectLive();
        setLiveBadge('live');
        if (liveToggleLabel) liveToggleLabel.textContent = 'Pause';
        if (liveToggleBtn) liveToggleBtn.setAttribute('aria-pressed', 'true');
    }
}

// --- UI states ------------------------------------------------------------
function showLoading(show) {
    loadingEl.classList.toggle('hidden', !show);
}

function showError(message) {
    errorMessageEl.textContent = message;
    errorEl.classList.remove('hidden');
    clearTimeout(showError._timer);
    showError._timer = setTimeout(() => errorEl.classList.add('hidden'), 6000);
}

function hideError() {
    clearTimeout(showError._timer);
    errorEl.classList.add('hidden');
}

// --- Auto-refresh (historical data) ---------------------------------------
function toggleAutoRefresh() {
    isAutoRefreshing = !isAutoRefreshing;

    if (isAutoRefreshing) {
        autoRefreshToggle.classList.add('is-on');
        autoRefreshToggle.setAttribute('aria-pressed', 'true');
        autoRefreshLabel.textContent = 'Auto-refresh: on';
        autoRefreshInterval = setInterval(() => fetchData({ loading: false }), AUTO_REFRESH_MS);
    } else {
        autoRefreshToggle.classList.remove('is-on');
        autoRefreshToggle.setAttribute('aria-pressed', 'false');
        autoRefreshLabel.textContent = 'Auto-refresh: off';
        clearInterval(autoRefreshInterval);
    }
}

// --- Theme ----------------------------------------------------------------
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme !== 'light';
    iconMoon.style.display = isDark ? '' : 'none';
    iconSun.style.display  = isDark ? 'none' : '';
    themeLabel.textContent = isDark ? 'Light' : 'Dark';

    // Re-render charts so they pick up the new palette.
    rerenderModelCharts();
    if (document.getElementById('liveChart')) initLiveChart();
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('dashboard-theme', next); } catch (e) { /* ignore */ }
    applyTheme(next);
}

// --- Init -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
    refreshBtn.addEventListener('click', () => fetchData({ loading: true }));
    autoRefreshToggle.addEventListener('click', toggleAutoRefresh);
    themeToggle.addEventListener('click', toggleTheme);
    if (dateFilterEl) dateFilterEl.addEventListener('change', () => fetchData({ loading: true }));
    if (liveToggleBtn) liveToggleBtn.addEventListener('click', toggleLive);

    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

    initLiveChart();
    loadDates();
    connectLive();

    setConnectionState('busy');
    fetchData({ loading: true });
});

window.addEventListener('resize', function () {
    if (genChart) genChart.resize();
    if (promptChart) promptChart.resize();
    if (liveChart) liveChart.resize();
});
