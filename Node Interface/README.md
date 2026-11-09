# Node.js Web Interface for Local LLM Analysis

A local web dashboard that visualizes performance data for your LM Studio (Bionic) models in real time. It parses the raw server logs **itself** (see `logParser.js`) — it does **not** shell out to the PowerShell parser in the repo root and does **not** read the generated `.txt` reports. That keeps the dashboard fully self-contained.

## Features
- **Self-contained log parsing** — `logParser.js` reads the raw `.log` files directly in Node.
- **Date filter** — pick a specific log date (`YYYY-MM-DD`) or view **all dates** (overall).
- **Live throughput feed** — a continuously-updating tokens/sec line chart over Server-Sent Events, so you never have to `tail` the log manually.
- **Stats cards** — overall average, log files, models detected, total samples.
- **Per-model throughput bar chart** (Chart.js) + a model breakdown table.
- **Light / dark theme** with persistence (no flash on load).
- **Auto-refresh** (optional 5s polling) + connection status indicator.

## API
| Endpoint | Description |
| --- | --- |
| `GET /api/dates` | Available log dates, newest first |
| `GET /api/performance-data` | Metrics, optionally scoped with `?date=YYYY-MM-DD` (default = all dates) |
| `GET /api/live` | Server-Sent Events stream of new tokens/sec samples (with a short seeded history) |
| `GET /api/health` | Liveness + current log root |

## Getting Started
```bash
npm install
npm start          # or: npm run dev (nodemon)
```
Open <http://localhost:3000>.

> The server reads LM Studio logs from `%USERPROFILE%\.lmstudio\apps\bionic\server-logs`.
> If that folder is missing, it falls back to the repo's `sample log/` directory.

## Directory Structure
```
Node Interface/
├── server.js           # Express server + /api/dates, /api/performance-data, /api/live (SSE)
├── logParser.js        # Self-contained raw-log parser (the dashboard's own data source)
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html      # Dashboard markup (terminal window layout)
│   ├── style.css       # Design tokens + light/dark themes
│   └── script.js       # Date filter, Chart.js, table, live feed, theme + auto-refresh
└── README.md           # This file
```

## How It Works
1. `logParser.js` walks the log root (`YYYY-MM/YYYY-MM-DD.N.log`), tracks the most
   recently loaded model, and extracts every `... N tokens per second` sample with its
   timestamp (a per-batch line that lacks a date-time prefix inherits the last one seen).
   Results are cached per file (size + mtime) so repeated refreshes are cheap.
2. `GET /api/performance-data?date=` aggregates samples into per-model + overall averages.
   `GET /api/dates` lists the available dates for the filter.
3. `GET /api/live` seeds the chart with a short trailing history, then polls the active
   log file every second for newly appended lines and emits each new sample as an SSE
   event. Log rotation (a newer file becoming active) is detected and reported.
4. The dashboard renders the stats cards, the per-model bar chart, the model table, and
   streams the live tokens/sec line chart via `EventSource`.

## Design
The visual language is adapted from the JoomunOS terminal aesthetic
(noorpersonalspace.africa): deep-navy base with radial teal/periwinkle glows,
glass panels, JetBrains Mono + Space Grotesk + Outfit type, soft glow, smooth
easing, and full light/dark theming. The chart palette is read from CSS
variables so it re-themes live.
