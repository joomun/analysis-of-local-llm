# Analysis of Local LLM
This repository contains tools to analyze logs from the local LLM server run by LM Studio (Bionic).

## How to use
1. **Generate report** – Run `Bilonic-Log-Report.bat` in a Command Prompt.
   * It will list available log directories under the default path `%USERPROFILE%\.lmstudio\apps\bionic\server-logs` or use the sample logs if present.
   * Choose a folder or press Enter to process all. The script will launch `GenerateReport.ps1` which parses the logs, extracts token‑per‑second metrics per model, and produces an HTML report in the `generated` subfolder.

2. **View report** – Open the generated HTML file with any browser.

The PowerShell script creates the output directory automatically if it does not exist.
