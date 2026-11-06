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
    # Create simple text report 
    $html = @"
Bionic Log Report – $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

No log files were found or no performance data was parsed.
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

# Create a simple text-based report instead of complex HTML to avoid escaping issues
$reportContent = @"
Bionic Log Report – $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

Model Performance Summary (Tokens per Second):
============================================

"@

foreach ($model in $avgTokenData.Keys | Sort-Object) {
    $avg = $avgTokenData[$model]
    $reportContent += "$model: $avg tokens/sec`n"
}

$reportContent += "`nOverall Average Performance: $overallAvg tokens per second`n"

# Write report to disk
$outFile = Join-Path $OutputDir ("report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt")
Set-Content -Path $outFile -Value $reportContent
Write-Host "✅ Report generated at: $outFile"