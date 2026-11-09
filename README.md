# Analysis of Local LLM

Tools and a local web dashboard for analyzing the performance logs produced by **LM Studio (Bionic)**. The pipeline measures token-per-second throughput for every model you run locally and turns raw server logs into readable reports and a live, visual dashboard.

## What's inside

| Component | Location | Purpose |
| --- | --- | --- |
| Log parser (CLI) | `Bilonic-Log-Report.bat` → `GenerateReport.ps1` | Parse LM Studio logs into a text report |
| Web dashboard | [`Node Interface/`](Node Interface/) | Self-contained visual monitoring (Express + Chart.js): date filter + live tokens/sec feed |
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

A local, real-time visualization of the same metrics — stats, a per-model chart, a model breakdown, a date filter, and a live tokens/sec feed — all in a clean terminal-inspired UI with light and dark themes. It is **self-contained**: it parses the raw logs itself (via `logParser.js`) and never depends on the PowerShell parser or the generated `.txt` reports.

### Getting started
From the [`Node Interface/`](Node Interface/) folder:

```bash
npm install
npm start          # or: npm run dev (nodemon)
```

Then open <http://localhost:3000>.

### Features
- **Date filter** — scope the metrics to a specific log date, or view **all dates** (overall)
- **Live throughput feed** — a continuously-updating tokens/sec line chart over Server-Sent Events (no manual `tail`)
- **Live metrics** — overall average, log files, models detected, total samples
- **Throughput chart** — per-model tokens/sec (Chart.js), re-themes with the UI
- **Model breakdown** — table of every model with sample counts
- **Auto-refresh** — optional 5-second polling
- **Light / dark theme** — persisted in `localStorage`, no flash on load
- **Status indicator** — online / busy / offline connection state

### How it works
`server.js` (Express) parses the raw logs via `logParser.js` and exposes:
- `GET /api/dates` — available log dates for the filter
- `GET /api/performance-data?date=YYYY-MM-DD` — per-model + overall metrics (default: all dates)
- `GET /api/live` — a Server-Sent Events stream of new tokens/sec samples (seeded with a short trailing history)

```
Node Interface/
├── server.js           # Express server + /api/dates, /api/performance-data, /api/live (SSE)
├── logParser.js        # Self-contained raw-log parser (the dashboard's own data source)
├── package.json
├── public/
│   ├── index.html      # Dashboard markup (terminal window layout)
│   ├── style.css       # Design tokens + light/dark themes
│   └── script.js       # Date filter, Chart.js, table, live feed, theme + auto-refresh
└── README.md
```

### Design
The visual language is adapted from the JoomunOS terminal aesthetic (noorpersonalspace.africa): deep-navy base with radial teal/periwinkle glows, glass panels, JetBrains Mono + Space Grotesk + Outfit type, soft glow, smooth easing, and full light/dark theming.

---

## Repository structure

```
.
├── Bilonic-Log-Report.bat    # CLI launcher (standalone report tool)
├── GenerateReport.ps1        # PowerShell log parser → .txt report (standalone report tool)
├── sample log/               # Fallback sample logs
├── generated/                # Output reports from the CLI tool (git-ignored)
├── Node Interface/           # Web dashboard (self-contained Express + Chart.js)
└── README.md
```
