param(
    [Parameter(Mandatory=$true)][string]$LogRoot,
    [Parameter()][string]$OutputDir="$PSScriptRoot/generated"
)

# ensure output dir exists
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# collect log files
if ($LogRoot -eq (Get-Item $LogRoot).Parent.FullName) {
    $logFiles = Get-ChildItem -Path $LogRoot -Recurse -Filter *.log | Where-Object { $_.FullName -notmatch '\\\\tmp\\\\|\.old$' }
} else {
    $logFiles = Get-ChildItem -Path $LogRoot -Filter *.log
}

# parse logs
$data = @{}
foreach ($file in $logFiles) {
    foreach ($line in Get-Content $file.FullName) {
        if ($line -match 'Model\s*:\s*(\\S+)\\s*Performance\\s*:\s*([\\d\.]+)') {
            $model, $score = $matches[1], [float]$matches[2]
            if (-not $data.ContainsKey($model)) { $data[$model] = @() }
            $data[$model] += @{ File=$file.Name; Score=$score; Path=$file.FullName }
        }
    }
}

# build HTML
$html = @"\n<!DOCTYPE html>\n<html lang=\\"en\\">\n<head>\n<meta charset=\\"utf-8\\">\n<title>Bionic Log Report</title>\n<link rel=\\"stylesheet\\" href=\\"https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css\\">\n<script src=\\"https://cdn.jsdelivr.net/npm/chart.js\\"></script>\n<style>body{margin:20px;}</style>\n</head>\n<body>\n<h1>Bionic Log Report – $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</h1>\n@"

# summary table
$html += "<h2>Model Performance Summary</h2>"
$html += '<table class=\\"table table-striped\\"><thead><tr><th>Model</th><th>Average Score</th></tr></thead><tbody>'
foreach ($model in $data.Keys | Sort-Object) {
    $scores = $data[$model] | ForEach-Object { $_.Score }
    $avg = [math]::Round(($scores | Measure-Object -Average).Average,3)
    $html += "<tr><td>$model</td><td>$avg</td></tr>"
}
$html += '</tbody></table>'

# bar chart data
$labels = ($data.Keys | Sort-Object) -join ','
$datasetsJS = @()
foreach ($model in $data.Keys | Sort-Object) {
    $scores = $data[$model] | ForEach-Object { $_.Score }
    $color  = "rgba(" + (Get-Random -Minimum 100 -Maximum 200) + "," + (Get-Random -Minimum 50 -Maximum 150) + ",200,0.7)"
    $datasetsJS += "{label:`\"$model`\",data:[" + ($scores -join ',') + "]],backgroundColor:'$color',borderColor:'rgb(54,162,235)',borderWidth:1}"
}
$html += @"\n<h2>Performance Bar Chart</h2>\n<canvas id=\\"perfChart\\" width=\\"800\\" height=\\"400\\"></canvas>\n<script>\nconst ctx = document.getElementById(\"perfChart\").getContext(\"2d\");\nnew Chart(ctx, {\n  type: \"bar\",\n  data: { labels: [$labels], datasets: [ $($datasetsJS -join ', ') ] },\n  options: { scales:{ y:{ beginAtZero:true } } }\n});\n</script>\n@"

$html += '</body></html>'

# output file
$outFile = Join-Path $OutputDir ("report_$(Get-Date -Format 'yyyyMMdd_HHmmss').html")
Set-Content -Path $outFile -Value $html
Write-Host "✅ Report generated at: $outFile"

# Git operations
git add "$outFile"
git commit -m \"Update report on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')\"
# Uncomment to push automatically:
# git push