param(
    [Parameter(Mandatory = $true)][string]$LogRoot,
    [Parameter()][string]$OutputDir = "$PSScriptRoot/generated"
)

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Collect log files
if ($LogRoot -eq (Get-Item $LogRoot).Parent.FullName) {
    $logFiles = Get-ChildItem -Path $LogRoot -Recurse -Filter *.log |
        Where-Object { $_.FullName -notmatch '\\tmp\\|\.old$' }
} else {
    $logFiles = Get-ChildItem -Path $LogRoot -Filter *.log
}

# Parse logs
# Collect token/sec metrics per model
$tokenData = @{}
$currentModel = ""
foreach ($file in $logFiles) {
    foreach ($line in Get-Content $file.FullName) {
        if ($line -match "loading model\\s+'([^']+)'") {
            $currentModel = Split-Path $matches[1] -Leaf
        }
        elseif ($line -match 'tokens per second\s*:\s*([\\d\\.]+)') {
            $value = [float]$matches[1]
        } elseif ($line -match '([\\d\\.]+)\\s+tokens per second') {
            $value = [float]$matches[1]
        }
        if ($currentModel -and $null -ne $value) {
            if (-not $tokenData.ContainsKey($currentModel)) { $tokenData[$currentModel] = @() }
            $tokenData[$currentModel] += $value
        }
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
foreach ($vals in $tokenData.Values) { $allValues += $vals }
$overallAvg = if ($allValues.Count -gt 0) {[math]::Round(($allValues | Measure-Object -Average).Average,3)} else {"N/A"}

# Add overall average to HTML report
$html += "<h2>Overall Average Performance: $overallAvg tokens per second</h2>"

# Build HTML
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
$html += '<table class="table table-striped"><thead><tr><th>Model</th><th>Avg Tokens/s</th></tr></thead><tbody>'
foreach ($model in $avgTokenData.Keys | Sort-Object) {
    $avg = $avgTokenData[$model]
    $html += "<tr><td>$model</td><td>$avg</td></tr>"
}
$html += '</tbody></table>'

# Bar‑chart data
$labels = ($avgTokenData.Keys | Sort-Object) -join ','
$datasets = @()
foreach ($model in $avgTokenData.Keys | Sort-Object) {
    $value = $avgTokenData[$model]
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
$datasetsJS = ($datasets | ConvertTo-Json -Depth 3).Trim('[', ']')
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

$html += '</body></html>'

# Write report to disk
$outFile = Join-Path $OutputDir ("report_$(Get-Date -Format 'yyyyMMdd_HHmmss').html")
Set-Content -Path $outFile -Value $html
Write-Host "✅ Report generated at: $outFile"
