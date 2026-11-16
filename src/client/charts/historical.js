// No module import; Chart is global via CDN

// Store references to the charts
export let genChart = null;
export let promptChart = null;

// Simple color palette for models
const colors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
    '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
    '#bcbd22', '#17becf'
];

function chartColors() {
    return colors;
}

export function initHistoricalCharts(models) {
    const labels = models.map(m => m.name);
    const colorMap = {};
    models.forEach((m, i) => { colorMap[m.name] = colors[i % colors.length]; });

    const ctxGen = document.getElementById('genChart');
    const ctxPrompt = document.getElementById('promptChart');
    if (!ctxGen || !ctxPrompt) return;

    genChart = new Chart(ctxGen, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tokens per second',
                data: models.map(m => m.genTps ?? 0),
                backgroundColor: labels.map(l => colorMap[l]),
                borderColor: labels.map(l => colorMap[l]),
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    promptChart = new Chart(ctxPrompt, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Tokens per second',
                data: models.map(m => m.promptTps ?? 0),
                backgroundColor: labels.map(l => colorMap[l]),
                borderColor: labels.map(l => colorMap[l]),
                borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

export function updateHistoricalCharts(models) {
    if (!genChart || !promptChart) return;
    const labels = models.map(m => m.name);
    const colorMap = {};
    models.forEach((m, i) => { colorMap[m.name] = colors[i % colors.length]; });

    genChart.data.labels = labels;
    genChart.data.datasets[0].data = models.map(m => m.genTps ?? 0);
    genChart.data.datasets[0].backgroundColor = labels.map(l => colorMap[l]);
    genChart.update();

    promptChart.data.labels = labels;
    promptChart.data.datasets[0].data = models.map(m => m.promptTps ?? 0);
    promptChart.data.datasets[0].backgroundColor = labels.map(l => colorMap[l]);
    promptChart.update();
}

export { chartColors };