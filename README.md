# Analysis of Local LLM

Tools and a local web dashboard for analyzing the performance logs produced by **LM Studio (Bionic)**. The pipeline measures token-per-second throughput for every model you run locally and turns raw server logs into readable reports and a live, visual dashboard.

## What's inside

| Component | Location | Purpose |
| --- | --- | --- |
| Log parser (CLI) | `Bilonic-Log-Report.bat` → `GenerateReport.ps1` | Parse LM Studio logs into a text report |
| Web dashboard | [`Node Interface/`](Node Interface/) | Real-time visual monitoring (Express + Chart.js) |
| Sample logs | `sample log/` | Fallback logs used when LM Studio logs are missing |
| Generated reports | `generated/` | Timestamped `.txt` reports (git-ignored) |

Both pieces read from the same source: the LM Studio Bionic server logs at
`%USERPROFILE%\.lmstudio\apps\bionic\server-logs`.

---

## 1. Command-line report (PowerShell)

Quick, dependency-free, great for a one-off look at your numbers.

1. **Generate the report** — run `Bilonic-Log-Report.bat` from a Command Prompt.
   - It checks for logs under `%USERPROFILE%\.lmstudio\apps\bionic\server-logs`.
   - If that folder is missing, it falls back to the `sample log/` directory.
   - It lists the available per-day log folders and lets you pick one, or press **Enter** to process all of them.
2. **View the report** — open the newest file in `generated/` (`report_<timestamp>.txt`).

`GenerateReport.ps1` is also scriptable directly:

```powershell
# -LogRoot is required; -OutputDir defaults to ./generated
./GenerateReport.ps1 -LogRoot "C:\path\to\logs" -OutputDir "C:\path\to\output"
```

### Report contents
- Per-model average throughput (tokens/sec) with sample counts
- Overall average across all models
- Stats: total log files, models detected, total performance samples

The output directory is created automatically if it does not exist.

---

## 2. Web dashboard (Node.js)

A local, real-time visualization of the same metrics — charts, a per-model breakdown, and the latest parsed report, all in a clean terminal-inspired UI with light and dark themes.

### Getting started
From the [`Node Interface/`](Node Interface/) folder:

```bash
npm install
npm start          # or: npm run dev (nodemon)
```

Then open <http://localhost:3000>.

### Features
- **Live metrics** — overall average, log files, models detected, total samples
- **Throughput chart** — per-model tokens/sec (Chart.js), re-themes with the UI
- **Model breakdown** — sortable-by-value table of every model
- **Recent report** — the actual parsed log report, not a placeholder
- **Auto-refresh** — optional 5-second polling
- **Light / dark theme** — persisted in `localStorage`, no flash on load
- **Status indicator** — online / busy / offline connection state

### How it works
`server.js` (Express) exposes `GET /api/performance-data`. On each call it runs the PowerShell parser, reads the most recent `generated/*.txt` report, parses it into structured JSON (models, overall average, stats, raw report text), and returns it to the dashboard.

```
Node Interface/
├── server.js           # Express server + /api/performance-data
├── package.json
├── public/
│   ├── index.html      # Dashboard markup (terminal window layout)
│   ├── style.css       # Design tokens + light/dark themes
│   └── script.js       # Fetch, Chart.js, table, theme + auto-refresh
└── README.md
```

### Design
The visual language is adapted from the JoomunOS terminal aesthetic (noorpersonalspace.africa): deep-navy base with radial teal/periwinkle glows, glass panels, JetBrains Mono + Space Grotesk + Outfit type, soft glow, smooth easing, and full light/dark theming.

---

## Repository structure

```
.
├── Bilonic-Log-Report.bat    # CLI launcher
├── GenerateReport.ps1        # PowerShell log parser → .txt report
├── sample log/               # Fallback sample logs
├── generated/                # Output reports (git-ignored)
├── Node Interface/           # Web dashboard (Express + Chart.js)
└── README.md
```
