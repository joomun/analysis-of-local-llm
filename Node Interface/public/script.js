// DOM Elements
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshToggle = document.getElementById('autoRefreshToggle');
const themeToggle = document.getElementById('themeToggle');
const lastUpdatedEl = document.getElementById('lastUpdated');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorMessageEl = document.getElementById('errorMessage');
const dashboardContent = document.getElementById('dashboard-content');

// Chart variables
let performanceChart = null;

// Auto-refresh state
let autoRefreshInterval = null;
let isAutoRefreshing = false;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loaded, fetching initial data...');
    fetchData();
    
    // Set up event listeners
    refreshBtn.addEventListener('click', fetchData);
    autoRefreshToggle.addEventListener('click', toggleAutoRefresh);
    themeToggle.addEventListener('click', toggleTheme);
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('dashboard-theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
});

// Fetch performance data from API
function fetchData() {
    showLoading(true);
    hideError();
    
    fetch('/api/performance-data')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received data:', data);
            updateDashboard(data);
            hideLoading();
        })
        .catch(error => {
            console.error('Fetch error:', error);
            showError(`Failed to fetch data: ${error.message}`);
            hideLoading();
        });
}

// Update the dashboard with new data
function updateDashboard(data) {
    // Update last updated timestamp
    const now = new Date();
    lastUpdatedEl.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    
    // Handle no data case
    if (!data.models || data.models.length === 0) {
        document.getElementById('overallAverage').textContent = 'N/A';
        document.getElementById('totalLogFiles').textContent = '0';
        document.getElementById('modelsDetected').textContent = '0';
        document.getElementById('totalSamples').textContent = '0';
        document.getElementById('reportFile').textContent = data.message || 'No data available';
        document.getElementById('reportContent').textContent = '';
        return;
    }
    
    // Update statistics cards
    document.getElementById('overallAverage').textContent = 
        data.overallAverage !== null ? `${data.overallAverage.toFixed(2)}` : 'N/A';
    document.getElementById('totalLogFiles').textContent = data.stats.totalLogFiles || '0';
    document.getElementById('modelsDetected').textContent = data.stats.modelsDetected || '0';
    document.getElementById('totalSamples').textContent = data.stats.totalSamples || '0';
    
    // Update report info
    document.getElementById('reportFile').textContent = data.reportFile || 'Unknown file';
    
    // Create sample content for the report (in real app this would be actual content)
    const reportContentEl = document.getElementById('reportContent');
    if (data.reportFile) {
        reportContentEl.textContent = `Report: ${data.reportFile}\nGenerated: ${new Date().toLocaleString()}`;
    } else {
        reportContentEl.textContent = 'No report available';
    }
    
    // Update model table
    updateModelTable(data.models);
    
    // Update chart
    updateChart(data.models);
}

// Update the models table
function updateModelTable(models) {
    const tbody = document.getElementById('modelTableBody');
    tbody.innerHTML = '';
    
    if (!models || models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No model data available</td></tr>';
        return;
    }
    
    // Sort by tokens per second (highest first)
    const sortedModels = [...models].sort((a, b) => b.tokensPerSec - a.tokensPerSec);
    
    sortedModels.forEach(model => {
        const row = document.createElement('tr');
        
        // Truncate long model names
        let modelName = model.name;
        if (modelName.length > 30) {
            modelName = modelName.substring(0, 27) + '...';
        }
        
        row.innerHTML = `
            <td title="${model.name}">${modelName}</td>
            <td>${model.tokensPerSec.toFixed(2)}</td>
            <td>${model.sampleCount}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Update the performance chart
function updateChart(models) {
    const ctx = document.getElementById('performanceChart');
    
    if (!ctx || !models || models.length === 0) {
        return;
    }
    
    // Destroy existing chart if it exists
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    // Prepare data for chart
    const labels = models.map(model => {
        // Truncate long names for chart display
        let name = model.name;
        if (name.length > 15) {
            name = name.substring(0, 12) + '...';
        }
        return name;
    });
    
    const dataValues = models.map(model => model.tokensPerSec);
    
    // Create new chart
    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tokens per Second',
                data: dataValues,
                backgroundColor: [
                    '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
                    '#9b59b6', '#1abc9c', '#34495e', '#d35400'
                ],
                borderColor: [
                    '#2980b9', '#27ae60', '#c0392b', '#d35400',
                    '#8e44ad', '#16a085', '#2c3e50', '#c0392b'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Tokens per Second'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Models'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(2)} tokens/sec`;
                        }
                    }
                }
            }
        }
    });
}

// Show loading state
function showLoading(show) {
    if (show) {
        loadingEl.classList.remove('hidden');
        dashboardContent.style.opacity = '0.5';
    } else {
        loadingEl.classList.add('hidden');
        dashboardContent.style.opacity = '1';
    }
}

// Hide loading state
function hideLoading() {
    showLoading(false);
}

// Show error message
function showError(message) {
    errorMessageEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 5000); // Auto-hide after 5 seconds
}

// Hide error message
function hideError() {
    errorEl.classList.add('hidden');
}

// Toggle auto-refresh functionality
function toggleAutoRefresh() {
    isAutoRefreshing = !isAutoRefreshing;
    
    if (isAutoRefreshing) {
        autoRefreshToggle.textContent = '▶️ Auto-refresh ON';
        autoRefreshInterval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    } else {
        autoRefreshToggle.textContent = '⏸️ Auto-refresh OFF';
        clearInterval(autoRefreshInterval);
    }
}

// Handle window resize for chart
window.addEventListener('resize', function() {
    if (performanceChart) {
        performanceChart.resize();
    }
});

// Toggle dark/light theme
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    
    // Save preference to localStorage
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('dashboard-theme', isDark ? 'dark' : 'light');
    
    // Update button text based on current theme
    if (isDark) {
        themeToggle.textContent = '☀️ Light Mode';
    } else {
        themeToggle.textContent = '🌓 Dark Mode';
    }
}
