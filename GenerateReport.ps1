param(
    [Parameter(Mandatory = $true)][string]$LogRoot,
    [Parameter()][string]$OutputDir = "$PSScriptRoot/generated"
)

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "🔍 Processing logs from: $LogRoot"

# Collect log files  
$logFiles = Get-ChildItem -Path $LogRoot -Filter *.log -Recurse
if ($logFiles.Count -eq 0) {
    Write-Host "⚠️  No .log files found in the specified path."
    # Create empty report anyway for consistency
    $html = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bionic Log Report</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
<style>body{margin:20px;}</style>
</head>
<body>
<h1>Bionic Log Report – $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</h1>
<p>No log files were found or no performance data was parsed.</p>
</body></html>
"@
    $outFile = Join-Path $OutputDir ("report_$(Get-Date -Format 'yyyyMMdd_HHmmss').html")
    Set-Content -Path $outFile -Value $html
    Write-Host "✅ Report generated at: $outFile"
    exit 0
}

Write-Host "📄 Found $($logFiles.Count) log file(s)"

# Parse logs for performance data
$tokenData = @{}
$currentModel = ""
foreach ($file in $logFiles) {
    Write-Host "⚙️  Processing: $($file.Name)"
    
    try {
        foreach ($line in Get-Content $file.FullName) {
            # Detect model load lines (the ones with loading model)
            if ($line -match "loading model\\s+'(.+?)'") {
                $modelPath = $matches[1]
                $currentModel = Split-Path $modelPath -Leaf
                Write-Host "   📦 Model detected: $currentModel"
            }
            
            # Extract tokens per second from timing lines (both formats)
            if ($line -match 'tokens per second\s*:\s*([0-9\.]+)') {
                $value = [float]$matches[1]
                Write-Host "   📊 Tokens/sec found: $value"
                
                if ($currentModel -and $null -ne $value) {
                    if (-not $tokenData.ContainsKey($currentModel)) { 
                        $tokenData[$currentModel] = @() 
                    }
                    $tokenData[$currentModel] += $value
                }
            } elseif ($line -match '([0-9\.]+)\s+tokens per second') {
                $value = [float]$matches[1]
                Write-Host "   📊 Tokens/sec found (space): $value"
                
                if ($currentModel -and $null -ne $value) {
                    if (-not $tokenData.ContainsKey($currentModel)) { 
                        $tokenData[$currentModel] = @() 
                    }
                    $tokenData[$currentModel] += $value
                }
            }
        } # end foreach line
    } catch {
        Write-Host "⚠️  Error processing file $($file.Name): $($_.Exception.Message)"
    }
}

# Compute averages per model
$avgTokenData = @{}
foreach ($model in $tokenData.Keys) {
    $scores = $tokenData[$model]
    if ($scores.Count -gt 0) {
        $avg = [math]::Round(($scores | Measure-Object -Average).Average,3)
        $avgTokenData[$model] = $avg
    }
}

# Overall average across all models  
$allValues = @()
foreach ($vals in $tokenData.Values) { 
    $allValues += $vals 
}
$overallAvg = if ($allValues.Count -gt 0) {
    [math]::Round(($allValues | Measure-Object -Average).Average,3)
} else {
    "N/A"
}

Write-Host "`n📊 Processed data:"
foreach ($model in $avgTokenData.Keys) {
    Write-Host "   $model: $($avgTokenData[$model]) tokens/sec average"
}
Write-Host "📈 Overall average: $overallAvg tokens/sec"

# Build HTML report with proper escaping
$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Bionic Log Report</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>body{margin:20px;} table{width:100%;} .chart-container{width:80%; margin:auto;}</style>
</head>
<body>
<h1>Bionic Log Report – $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</h1>
"@

# Summary table
$html += "<h2>Model Performance Summary (Tokens per Second)</h2>"
if ($avgTokenData.Count -eq 0) {
    $html += "<p>No performance data found in logs.</p>"
} else {
    $html += '<table class="table table-striped"><thead><tr><th>Model</th><th>Avg Tokens/s</th></tr></thead><tbody>'
    foreach ($model in $avgTokenData.Keys | Sort-Object) {
        $avg = $avgTokenData[$model]
        $html += "<tr><td>$model</td><td>$avg</td></tr>"
    }
    $html += '</tbody></table>'
}

# Overall average
$html += "<h2>Overall Average Performance: $overallAvg tokens per second</h2>"

# Bar-chart data (only if we have data)
if ($avgTokenData.Count -gt 0) {
    # Prepare chart data  
    $labels = ($avgTokenData.Keys | Sort-Object) -join ','
    $datasets = @()
    
    foreach ($model in $avgTokenData.Keys | Sort-Object) {
        $value = $avgTokenData[$model]
        # Generate a color
        $color  = "rgba(" + (Get-Random -Minimum 100 -Maximum 200) + "," +
                  (Get-Random -Minimum 50 -Maximum 150) + ",200,0.7)"
        
        $datasets += [pscustomobject]@{
            label           = $model
            data            = @($value)
            backgroundColor = $color
            borderColor     = 'rgb(54,162,235)'
            borderWidth     = 1
        }
    }
    
    # Generate the chart only if we have datasets
    $datasetsJS = if ($datasets.Count -gt 0) {
        ($datasets | ConvertTo-Json -Depth 3).Trim('[', ']')
    } else {
        "[]"
    }
    
    $html += @"
<h2>Performance Bar Chart</h2>
<div class="chart-container"><canvas id="perfChart" width="800" height="400"></canvas></div>
<script>
const ctx = document.getElementById("perfChart").getContext("2d");
new Chart(ctx, {
  type: "bar",
  data: { labels: [$labels], datasets: [ $datasetsJS ] },
  options: { scales:{ y:{ beginAtZero:true } } }
});
</script>
"@
}

$html += '</body></html>'

# Write report to disk
$outFile = Join-Path $OutputDir ("report_$(Get-Date -Format 'yyyyMMdd_HHmmss').html")
Set-Content -Path $outFile -Value $html
Write-Host "✅ Report generated at: $outFile"