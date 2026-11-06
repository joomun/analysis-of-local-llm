param(
    [Parameter(Mandatory = $true)]
    [string]$LogRoot,

    [Parameter()]
    [string]$OutputDir = "$PSScriptRoot/generated"
)

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "Processing logs from: $LogRoot" -ForegroundColor Cyan

# Validate log directory
if (-not (Test-Path -LiteralPath $LogRoot -PathType Container)) {
    Write-Error "Log directory does not exist: $LogRoot"
    exit 1
}

# Collect log files
$logFiles = @(Get-ChildItem -LiteralPath $LogRoot -Filter "*.log" -Recurse -File)

if ($logFiles.Count -eq 0) {
    Write-Warning "No .log files found."

    $reportContent = @"
Bionic Log Report - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

No log files were found.
"@

    $outFile = Join-Path $OutputDir "report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

    Set-Content -Path $outFile -Value $reportContent -Encoding UTF8

    Write-Host "Report generated at: $outFile" -ForegroundColor Green
    exit 0
}

Write-Host "Found $($logFiles.Count) log file(s)" -ForegroundColor Green

# Store performance data
$tokenData = @{}

foreach ($file in $logFiles) {

    Write-Host "Processing: $($file.Name)" -ForegroundColor Yellow

    $currentModel = ""

    try {

        foreach ($line in Get-Content -LiteralPath $file.FullName -ErrorAction Stop) {

            # Detect model loading
            if ($line -match "loading model\s+'(.+?)'") {

                $modelPath = $matches[1]
                $currentModel = Split-Path $modelPath -Leaf

                Write-Host "  Model detected: $currentModel"
            }

            # Extract tokens per second
            $value = $null

            if ($line -match 'tokens per second\s*:\s*([0-9]+(?:\.[0-9]+)?)') {

                $value = [double]::Parse(
                    $matches[1],
                    [System.Globalization.CultureInfo]::InvariantCulture
                )

            }
            elseif ($line -match '([0-9]+(?:\.[0-9]+)?)\s+tokens per second') {

                $value = [double]::Parse(
                    $matches[1],
                    [System.Globalization.CultureInfo]::InvariantCulture
                )
            }

            if ($null -ne $value -and $currentModel) {

                if (-not $tokenData.ContainsKey($currentModel)) {
                    $tokenData[$currentModel] = @()
                }

                $tokenData[$currentModel] += $value

                Write-Host "  Tokens/sec: $value" -ForegroundColor Cyan
            }
        }

    }
    catch {
        Write-Warning "Error processing $($file.Name): $($_.Exception.Message)"
    }
}

# Calculate averages
$avgTokenData = @{}

foreach ($model in $tokenData.Keys) {

    $scores = $tokenData[$model]

    if ($scores.Count -gt 0) {

        $avg = [math]::Round(
            ($scores | Measure-Object -Average).Average,
            3
        )

        $avgTokenData[$model] = $avg
    }
}

# Calculate overall average
$allValues = @()

foreach ($values in $tokenData.Values) {
    $allValues += $values
}

if ($allValues.Count -gt 0) {

    $overallAvg = [math]::Round(
        ($allValues | Measure-Object -Average).Average,
        3
    )

}
else {
    $overallAvg = "N/A"
}

# Display results
Write-Host "`nPerformance Summary" -ForegroundColor Green

foreach ($model in $avgTokenData.Keys) {

    Write-Host "  ${model}: $($avgTokenData[$model]) tokens/sec"
}

Write-Host "Overall average: $overallAvg tokens/sec"

# Generate report
$reportContent = @"
BIONIC LOG REPORT
Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

MODEL PERFORMANCE SUMMARY
=============================================

"@

foreach ($model in ($avgTokenData.Keys | Sort-Object)) {

    $avgValue = $avgTokenData[$model]

    $sampleCount = $tokenData[$model].Count

    $reportContent += "${model}: $avgValue tokens/sec ($sampleCount samples)`n"
}

$reportContent += @"

=============================================
Overall Average: $overallAvg tokens/sec

Total log files: $($logFiles.Count)
Models detected: $($avgTokenData.Count)
Total performance samples: $($allValues.Count)
"@

# Save report
$outFile = Join-Path $OutputDir "report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"

Set-Content -Path $outFile -Value $reportContent -Encoding UTF8

Write-Host "`nReport generated successfully:" -ForegroundColor Green
Write-Host $outFile
