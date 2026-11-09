# Node.js Web Interface for Local LLM Analysis

A local web dashboard that visualizes performance data for your LM Studio (Bionic) models in real time. It parses the raw server logs **itself** (see `logParser.js`) — it does **not** shell out to the PowerShell parser in the repo root and does **not** read the generated `.txt` reports. That keeps the dashboard fully self-contained.

## Features
- **Self-contained log parsing** — `logParser.js` reads the raw `.log` files directly in Node.
- **Prompt vs generation split** — prompt processing (pre-fill) and token generation are measured separately, because they differ by an order of magnitude and mean different things. Two side-by-side bar charts + a combined per-model table.
- **Stats cards** — avg generation speed, avg prompt speed, requests completed, tokens generated, models detected, warnings & errors.
- **Per-model breakdown** — gen tok/s, prompt tok/s, task count, tokens generated, speculative-decoding draft acceptance, average load time, and a **vision** badge for multimodal (mmproj) models.
- **Model sessions** — every model load with start time, load duration (seconds), context size, slots, threads, port, and vision support — so model comparisons happen on equal footing.
- **Health & warnings** — recent warnings (`W` lines) and errors (`[ERROR]` lines, e.g. 500s / Jinja template exceptions) with timestamps, plus a truncated-output counter.
- **Live throughput feed** — a continuously-updating generation tok/s line chart over Server-Sent Events (with a prompt-tok/s readout), active model, and new model loads announced in real time, so you never have to `tail` the log manually.
- **Date filter** — pick a specific log date (`YYYY-MM-DD`) or view **all dates** (overall).
- **Light / dark theme** with persistence (no flash on load).
- **Auto-refresh** (optional 5s polling) + connection status indicator.

## API
| Endpoint | Description |
| --- | --- |
| `GET /api/dates` | Available log dates, newest first |
| `GET /api/performance-data` | Full dashboard payload — per-model metrics (prompt + generation tok/s, tokens, draft acceptance, vision, load times), model sessions, health events (warnings/errors), overall stats — optionally scoped with `?date=YYYY-MM-DD` (default = all dates) |
| `GET /api/live` | Server-Sent Events stream: `init` (active file + seeded history + active model), `sample` (completed task: generation + prompt tok/s), `model` (model load), `events` (warnings/errors), `meta` (log rotation) |
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
1. `logParser.js` walks the log root (`YYYY-MM/YYYY-MM-DD.N.log`) and tracks three
   things per file:
   - **Tasks** — one per inference job. The `prompt eval time` line gives prompt (pre-fill)
     tokens/sec + prompt token count; the `eval time` line gives generation tokens/sec +
     generated token count; optional `draft acceptance` lines feed the speculative-decoding
     stats. Lines without a date-time prefix inherit the last timestamp seen.
   - **Sessions** — `loading model` → `model loaded` gives load duration; the surrounding
     lines contribute context size (`n_ctx_slot`), slots (`n_slots`), threads (`n_threads`),
     the listening port, and whether a multimodal projection (mmproj) was loaded.
   - **Health** — every `W` warning and `[ERROR]` line (e.g. 500 responses, Jinja template
     exceptions), with timestamp and message (capped per file for memory).
   Results are cached per file (size + mtime) so repeated refreshes are cheap.
2. `GET /api/performance-data?date=` aggregates tasks/sessions/events into per-model and
   overall metrics (averages, min/max, token totals, draft acceptance weighted by
   accepted/generated, truncated counters). `GET /api/dates` lists the filter options.
3. `GET /api/live` seeds the chart with a short trailing history, then polls the active
   log file every second for newly appended lines and emits completed tasks as `sample`
   events (generation tok/s as the primary value, prompt tok/s alongside), plus `model`
   events on model loads and `events` for warnings/errors. Log rotation (a newer file
   becoming active) is detected and reported.
4. The dashboard renders the stats cards, the two per-model bar charts, the model
   breakdown table, the sessions table, the health panel, and streams the live tokens/sec
   line chart via `EventSource`.

## Design
The visual language is adapted from the JoomunOS terminal aesthetic
(noorpersonalspace.africa): deep-navy base with radial teal/periwinkle glows,
glass panels, JetBrains Mono + Space Grotesk + Outfit type, soft glow, smooth
easing, and full light/dark theming. The chart palette is read from CSS
variables so it re-themes live.
