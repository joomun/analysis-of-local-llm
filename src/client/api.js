// API wrappers for HTTP requests

export async function getDates() {
    const resp = await fetch('/api/dates');
    if (!resp.ok) throw new Error(`Failed to load dates: ${resp.status}`);
    return resp.json();
}

export async function getPerformanceData(date=null) {
    const url = '/api/performance-data' + (date ? `?date=${encodeURIComponent(date)}` : '');
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to load performance data: ${resp.status}`);
    return resp.json();
}

export async function getHealth() {
    const resp = await fetch('/api/health');
    if (!resp.ok) throw new Error(`Failed to load health: ${resp.status}`);
    return resp.json();
}
