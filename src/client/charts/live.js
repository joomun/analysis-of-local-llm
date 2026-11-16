// No module import; Chart is global via CDN

let liveChart = null;
let eventSource = null;
const liveData = {
    timestamps: [],
    tpsValues: [],
    promptTpsValues: []
};

export function initLiveChart() {
    const ctx = document.getElementById('liveChart');
    if (!ctx) return;
    liveChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Gen Tps', borderColor: '#1f77b4', fill: false, tension: 0.2 },
                { label: 'Prompt Tps', borderColor: '#ff7f0e', fill: false, tension: 0.2 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false
        }
    });
}

export function connectLive() {
    if (eventSource) return; // already connected
    eventSource = new EventSource('/api/live');
    eventSource.addEventListener('init', e => {
        const data = JSON.parse(e.data);
        document.getElementById('liveFile').textContent = data.file || '—';
        if (data.history) {
            liveData.timestamps.length = 0;
            liveData.tpsValues.length = 0;
            liveData.promptTpsValues.length = 0;
            data.history.forEach(s => addSample(s));
            updateChart();
        }
    });
    eventSource.addEventListener('sample', e => {
        const s = JSON.parse(e.data);
        addSample(s);
        updateChart();
        // Update live values
        document.getElementById('liveCurrent').textContent = (s.tps ?? 0).toFixed(2);
        document.getElementById('livePrompt').textContent = (s.promptTps ?? 0).toFixed(2);
    });
    eventSource.addEventListener('model', e => {
        const m = JSON.parse(e.data);
        document.getElementById('liveModel').textContent = m.model || '—';
    });
    eventSource.addEventListener('events', e => {
        // ignore for now
    });
    eventSource.addEventListener('meta', e => {
        const d = JSON.parse(e.data);
        document.getElementById('liveFile').textContent = d.file || '—';
    });
}

export function disconnectLive() {
    if (eventSource) { eventSource.close(); eventSource = null; }
}

export function toggleLive() {
    if (!eventSource) return;
    // pause by closing and reconnecting? For simplicity, we just close.
    disconnectLive();
}

function addSample(sample) {
    const ts = new Date(sample.ts).getTime();
    liveData.timestamps.push(ts);
    liveData.tpsValues.push(sample.tps ?? 0);
    liveData.promptTpsValues.push(sample.promptTps ?? 0);
    // keep only latest 240 samples
    if (liveData.timestamps.length > 240) {
        liveData.timestamps.shift();
        liveData.tpsValues.shift();
        liveData.promptTpsValues.shift();
    }
}

function updateChart() {
    if (!liveChart) return;
    const labels = liveData.timestamps.map(t => new Date(t).toLocaleTimeString());
    liveChart.data.labels = labels;
    liveChart.data.datasets[0].data = liveData.tpsValues;
    liveChart.data.datasets[1].data = liveData.promptTpsValues;
    liveChart.update();
}

export { initLiveChart, connectLive, disconnectLive, toggleLive };
