# Analysis of Local LLM
This repository contains tools to analyze logs from the local LLM server run by LM Studio (Bionic).

## How to use
1. **Generate report** – Run `Bilonic-Log-Report.bat` in a Command Prompt.
   * It will detect and list available log directories under `%USERPROFILE%\.lmstudio\apps\bionic\server-logs`
   * Choose a folder or press Enter to process all logs from that directory
   * The script will launch `GenerateReport.ps1` which parses the logs, extracts token‑per‑second metrics per model, and produces a text report in the `generated` subfolder

2. **View report** – Open the generated `.txt` file with any text editor or browser.

## Output Format
The generated reports show:
- Performance data for each model (average tokens/sec)
- Overall average performance across all models  
- Statistics including number of log files and samples processed

The PowerShell script creates the output directory automatically if it does not exist.