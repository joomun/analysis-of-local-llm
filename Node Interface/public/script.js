/* =========================================================================
   Local LLM Performance Monitor — frontend
   Fetches parsed log metrics, renders stats, a bar chart, and a model table.
   Theme is driven by the `data-theme` attribute on <html> (dark / light).
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
const dashboardContent  = document.getElementById('dashboard-content');
const connStatus        = document.getElementById('connStatus');
const statusText        = document.getElementById('statusText');

// --- State ----------------------------------------------------------------
let performanceChart = null;
let autoRefreshInterval = null;
let isAutoRefreshing = false;
let lastModels = [];

const AUTO_REFRESH_MS = 5000;

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

// --- Data -----------------------------------------------------------------
function fetchData() {
    setConnectionState('busy');
    dashboardContent.classList.add('is-loading');
    hideError();

    fetch('/api/performance-data')
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then((data) => {
            updateDashboard(data);
            setConnectionState('online');
            dashboardContent.classList.remove('is-loading');
        })
        .catch((error) => {
            console.error('Fetch error:', error);
            showError(`Failed to fetch data: ${error.message}`);
            setConnectionState('offline');
            dashboardContent.classList.remove('is-loading');
        });
}

function updateDashboard(data) {
    const now = new Date();
    lastUpdatedEl.textContent = `updated ${now.toLocaleTimeString()}`;

    lastModels = Array.isArray(data.models) ? data.models : [];
    const stats = data.stats || {};

    document.getElementById('overallAverage').textContent =
        data.overallAverage !== null && data.overallAverage !== undefined
            ? data.overallAverage.toFixed(2)
            : 'N/A';
    document.getElementById('totalLogFiles').textContent  = stats.totalLogFiles   ?? '0';
    document.getElementById('modelsDetected').textContent = stats.modelsDetected  ?? '0';
    document.getElementById('totalSamples').textContent   = stats.totalSamples    ?? '0';

    // Report panel
    const reportFileEl = document.getElementById('reportFile');
    const reportPreEl  = document.getElementById('reportContent');
    if (data.reportFile) {
        reportFileEl.textContent = data.reportFile;
    } else {
        reportFileEl.textContent = 'no report yet';
    }
    if (typeof data.reportContent === 'string' && data.reportContent.trim()) {
        reportPreEl.textContent = data.reportContent;
    } else if (data.message) {
        reportPreEl.textContent = data.message;
    } else {
        reportPreEl.textContent = 'No report available yet.';
    }

    // Table + count
    const models = Array.isArray(data.models) ? data.models : [];
    document.getElementById('modelCount').textContent = `${models.length} model${models.length === 1 ? '' : 's'}`;
    updateModelTable(models);

    // Chart
    updateChart(models);
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
        tpsCell.textContent = model.tokensPerSec.toFixed(2);

        const sampleCell = document.createElement('td');
        sampleCell.className = 'num';
        sampleCell.textContent = model.sampleCount;

        row.append(nameCell, tpsCell, sampleCell);
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

// --- Chart ----------------------------------------------------------------
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
    if (!ctxEl || !models || models.length === 0) return;

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
                        label: (context) => `${context.parsed.y.toFixed(2)} tokens/sec`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: c.grid },
                    border: { display: false },
                    ticks: { color: c.textMuted, font: { family: 'JetBrains Mono', size: 12 } },
                    title: {
                        display: true,
                        text: 'tokens / sec',
                        color: c.textMuted,
                        font: { family: 'JetBrains Mono', size: 11 },
                    },
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

// --- Auto-refresh ---------------------------------------------------------
function toggleAutoRefresh() {
    isAutoRefreshing = !isAutoRefreshing;

    if (isAutoRefreshing) {
        autoRefreshToggle.classList.add('is-on');
        autoRefreshToggle.setAttribute('aria-pressed', 'true');
        autoRefreshLabel.textContent = 'Auto-refresh: on';
        autoRefreshInterval = setInterval(fetchData, AUTO_REFRESH_MS);
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

    // Re-render the chart so it picks up the new palette.
    const models = Array.isArray(lastModels) ? lastModels : [];
    if (models.length) updateChart(models);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('dashboard-theme', next); } catch (e) { /* ignore */ }
    applyTheme(next);
}

// --- Init -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
    refreshBtn.addEventListener('click', fetchData);
    autoRefreshToggle.addEventListener('click', toggleAutoRefresh);
    themeToggle.addEventListener('click', toggleTheme);

    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');

    setConnectionState('busy');
    fetchData();
});

window.addEventListener('resize', function () {
    if (performanceChart) performanceChart.resize();
});
