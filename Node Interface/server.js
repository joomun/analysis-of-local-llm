const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const PORT = 3000;

// Serve static files from 'public' directory
app.use(express.static('public'));

// Middleware to parse JSON bodies
app.use(express.json());

// Route for the main dashboard page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to get performance data from logs
app.get('/api/performance-data', (req, res) => {
    // Execute the PowerShell script to generate new report
    const powershellScript = path.join(__dirname, '..', 'GenerateReport.ps1');
    const logRoot = path.join(process.env.USERPROFILE, '.lmstudio', 'apps', 'bionic', 'server-logs');
    
    console.log('Attempting to parse logs from:', logRoot);
    
    // Execute PowerShell script using cmd
    exec(`powershell -ExecutionPolicy Bypass -File "${powershellScript}" -LogRoot "${logRoot}"`, 
        { cwd: __dirname },
        (error, stdout, stderr) => {
            if (error) {
                console.error('Error executing PowerShell script:', error);
                return res.status(500).json({ 
                    error: 'Failed to generate performance report', 
                    details: stderr 
                });
            }
            
            // Read the latest generated report
            const generatedDir = path.join(__dirname, '..', 'generated');
            fs.readdir(generatedDir, (err, files) => {
                if (err) {
                    console.error('Error reading generated directory:', err);
                    return res.status(500).json({ 
                        error: 'Failed to read generated reports' 
                    });
                }
                
                // Find the most recent txt file
                const txtFiles = files.filter(file => file.endsWith('.txt'));
                if (txtFiles.length === 0) {
                    console.log('No txt report found');
                    return res.json({ message: 'No performance data available yet' });
                }
                
                const latestFile = txtFiles.reduce((latest, current) => {
                    const currentPath = path.join(generatedDir, current);
                    const latestPath = path.join(generatedDir, latest);
                    return fs.statSync(currentPath).mtime > fs.statSync(latestPath).mtime ? current : latest;
                });
                
                const reportPath = path.join(generatedDir, latestFile);
                fs.readFile(reportPath, 'utf8', (err, data) => {
                    if (err) {
                        console.error('Error reading report file:', err);
                        return res.status(500).json({ 
                            error: 'Failed to read performance report' 
                        });
                    }
                    
                    // Parse the text report into structured data
                    const parsedData = parseReportText(data);
                    res.json({
                        reportFile: latestFile,
                        timestamp: new Date().toISOString(),
                        ...parsedData
                    });
                });
            });
        });
});

// Function to parse the text report format into structured data
function parseReportText(reportContent) {
    const lines = reportContent.split('\n');
    const result = { models: [], overallAverage: null, stats: {} };
    
    let inModelSection = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Look for model performance data
        if (line.includes('MODEL PERFORMANCE SUMMARY') || 
            line.includes('=============================================')) {
            inModelSection = true;
            continue;
        }
        
        if (inModelSection && line === '=============================================') {
            inModelSection = false;
            continue;
        }
        
        if (inModelSection && line.length > 0 && !line.startsWith('BIONIC LOG REPORT') && 
            !line.includes('Generated:') && !line.includes('Total log files:') && 
            !line.includes('Models detected:') && !line.includes('Total performance samples:')) {
            
            // Parse model data like "Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf: 244.703 tokens/sec (364 samples)"
            const match = line.match(/^(.+?):\s+([0-9.]+)\s+tokens\/sec\s+\((\d+)\s+samples\)/);
            
            if (match) {
                result.models.push({
                    name: match[1],
                    tokensPerSec: parseFloat(match[2]),
                    sampleCount: parseInt(match[3])
                });
            }
        }
        
        // Parse overall average
        if (line.includes('Overall Average:')) {
            const match = line.match(/Overall Average:\s+([0-9.]+)\s+tokens\/sec/);
            if (match) {
                result.overallAverage = parseFloat(match[1]);
            }
        }
        
        // Parse stats section
        if (line.includes('Total log files:')) {
            const match = line.match(/Total log files:\s+(\d+)/);
            if (match) result.stats.totalLogFiles = parseInt(match[1]);
        }
        
        if (line.includes('Models detected:')) {
            const match = line.match(/Models detected:\s+(\d+)/);
            if (match) result.stats.modelsDetected = parseInt(match[1]);
        }
        
        if (line.includes('Total performance samples:')) {
            const match = line.match(/Total performance samples:\s+(\d+)/);
            if (match) result.stats.totalSamples = parseInt(match[1]);
        }
    }
    
    return result;
}

// Start the server
app.listen(PORT, () => {
    console.log(`LLM Performance Dashboard is running on http://localhost:${PORT}`);
});

module.exports = app;