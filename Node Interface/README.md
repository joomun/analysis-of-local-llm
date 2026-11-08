# Node.js Web Interface for Local LLM Analysis

A local web dashboard that visualizes performance data for your LM Studio (Bionic) models in real time. It reads the same server logs as the PowerShell parser in the repo root and turns them into charts, a per-model breakdown, and the latest parsed report.

## Current Status
- [x] Express server + static asset serving
- [x] `/api/performance-data` endpoint (runs the PowerShell parser, returns structured JSON + raw report text)
- [x] Log file parsing integration
- [x] Real-time dashboard UI (stats, chart, model table, recent report)
- [x] Light / dark theme with persistence (no flash on load)
- [x] Auto-refresh (optional 5s polling) + connection status indicator

## Planned Features
- [ ] Historical data storage — persist metrics over time for trend charts
- [ ] Token/sec **trend** line chart alongside the per-model bar chart
- [ ] Multiple model comparison — side-by-side selection
- [ ] Configurable log root + refresh interval from the UI

## Getting Started
```bash
npm install
npm start          # or: npm run dev (nodemon)
```
Open <http://localhost:3000>.

> The server calls `../GenerateReport.ps1`, so it expects to run from this
> folder inside the repository.

## Directory Structure
```
Node Interface/
├── server.js           # Express server + /api/performance-data
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html      # Dashboard markup (terminal window layout)
│   ├── style.css       # Design tokens + light/dark themes
│   └── script.js       # Fetch, Chart.js, table, theme + auto-refresh
└── README.md           # This file
```

## How It Works
1. The browser calls `GET /api/performance-data`.
2. `server.js` runs the PowerShell parser against the LM Studio server logs,
   reads the most recent `generated/*.txt` report, and parses it into
   structured data (models, overall average, stats, raw report text).
3. The dashboard renders the stats cards, a Chart.js throughput bar chart, a
   sortable-by-value model table, and the recent report panel.

## Design
The visual language is adapted from the JoomunOS terminal aesthetic
(noorpersonalspace.africa): deep-navy base with radial teal/periwinkle glows,
glass panels, JetBrains Mono + Space Grotesk + Outfit type, soft glow, smooth
easing, and full light/dark theming. The chart palette is read from CSS
variables so it re-themes live.
