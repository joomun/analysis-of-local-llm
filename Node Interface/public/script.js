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
let performanceChart = null;
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

    document.getElementById('overallAverage').textContent =
        (data.overallAverage !== null && data.overallAverage !== undefined)
            ? Number(data.overallAverage).toFixed(2)
            : 'N/A';
    document.getElementById('totalLogFiles').textContent  = stats.totalLogFiles   ?? '0';
    document.getElementById('modelsDetected').textContent = stats.modelsDetected  ?? '0';
    document.getElementById('totalSamples').textContent   = stats.totalSamples    ?? '0';

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

    // Bar chart
    updateChart(models);
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
        count.textContent = `${f.samples ?? 0} sample${(f.samples ?? 0) === 1 ? '' : 's'}`;
        li.append(name, count);
        fragment.appendChild(li);
    });
    list.appendChild(fragment);
}

function updateModelTable(models) {
    const tbody = document.getElementById('modelTableBody');
    tbody.innerHTML = '';

    if (!models || models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No model data available</td></tr>';
        return;
    }

    const sorted = [...models].sort((a, b) => b.tokensPerSec - a.tokensPerSec);
    const fragment = document.createDocumentFragment();

    sorted.forEach((model) => {
        const row = document.createElement('tr');

        const nameCell = document.createElement('td');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'model-name';
        nameSpan.textContent = model.name;
        nameSpan.title = model.name;
        nameCell.appendChild(nameSpan);

        const tpsCell = document.createElement('td');
        tpsCell.className = 'num tps';
        tpsCell.textContent = Number(model.tokensPerSec).toFixed(2);

        const sampleCell = document.createElement('td');
        sampleCell.className = 'num';
        sampleCell.textContent = model.sampleCount;

        row.append(nameCell, tpsCell, sampleCell);
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
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

function updateChart(models) {
    const ctxEl = document.getElementById('performanceChart');
    if (!ctxEl) return;

    if (performanceChart) performanceChart.destroy();

    const c = chartColors();
    const barPalette = [c.accent, c.accent2, c.accent3, c.green];
    const labels = models.map((m) => {
        const name = m.name || '';
        return name.length > 18 ? `${name.slice(0, 15)}…` : name;
    });

    performanceChart = new Chart(ctxEl, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tokens per Second',
                data: models.map((m) => m.tokensPerSec),
                backgroundColor: models.map((_, i) => barPalette[i % barPalette.length]),
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
    liveLabels.push(label);
    liveData.push(value);
    while (liveLabels.length > LIVE_MAX_POINTS) { liveLabels.shift(); liveData.shift(); }
    updateLiveChart();
}

function setLiveReadout(value, model, timeLabel) {
    const cur = document.getElementById('liveCurrent');
    const mdl = document.getElementById('liveModel');
    const last = document.getElementById('liveLast');
    if (cur)  cur.textContent = (value === null || value === undefined) ? '–' : Number(value).toFixed(2);
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
        const label = s.ts ? String(s.ts).slice(11) : String(idx);
        liveLabels.push(label);
        liveData.push(Number(s.tps));
        idx++;
    }
    while (liveLabels.length > LIVE_MAX_POINTS) { liveLabels.shift(); liveData.shift(); }
    const last = history.length ? history[history.length - 1] : null;
    if (last) setLiveReadout(last.tps, last.model, last.ts ? String(last.ts).slice(11) : '–');
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
        seedLive(Array.isArray(payload.history) ? payload.history : []);
        setLiveBadge('live');
    });

    liveSource.addEventListener('sample', (ev) => {
        let s;
        try { s = JSON.parse(ev.data); } catch (e) { return; }
        const label = s.ts ? String(s.ts).slice(11) : String(liveLabels.length);
        appendLivePoint(label, Number(s.tps));
        setLiveReadout(s.tps, s.model, label);
        setLiveBadge('live');
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
    const models = Array.isArray(lastModels) ? lastModels : [];
    if (models.length) updateChart(models);
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
    if (performanceChart) performanceChart.resize();
    if (liveChart) liveChart.resize();
});
