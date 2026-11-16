# Graph Report - analysis-of-local-llm  (2026-11-16)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 97 nodes · 150 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1a25e09f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- script.js
- package.json
- logParser.js
- server.js
- connectLive
- applyTheme
- parseTextToData
- fetchData
- updateDashboard
- getPerformanceData

## God Nodes (most connected - your core abstractions)
1. `connectLive()` - 7 edges
2. `fetchData()` - 7 edges
3. `updateDashboard()` - 7 edges
4. `getPerformanceData()` - 7 edges
5. `parseTextToData()` - 5 edges
6. `listLogFiles()` - 5 edges
7. `seedLive()` - 4 edges
8. `toggleLive()` - 4 edges
9. `applyTheme()` - 4 edges
10. `chartColors()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `getPerformanceData()` --calls--> `aggregate()`  [EXTRACTED]
  Node Interface/logParser.js → Node Interface/logParser.js  _Bridges community 2 → community 9_
- `updateDashboard()` --calls--> `updateBarChart()`  [EXTRACTED]
  Node Interface/public/script.js → Node Interface/public/script.js  _Bridges community 5 → community 8_
- `getPerformanceData()` --calls--> `getDataForFile()`  [EXTRACTED]
  Node Interface/logParser.js → Node Interface/logParser.js  _Bridges community 6 → community 9_
- `fetchData()` --calls--> `updateDashboard()`  [EXTRACTED]
  Node Interface/public/script.js → Node Interface/public/script.js  _Bridges community 7 → community 8_

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "script.js"
Cohesion: 0.10
Nodes (19): autoRefreshLabel, autoRefreshToggle, connStatus, dateFilterEl, errorEl, errorMessageEl, iconMoon, iconSun (+11 more)

### Community 1 - "package.json"
Cohesion: 0.13
Nodes (16): author, dependencies, express@^4.18.2, description, devDependencies, nodemon@^3.0.1, keywords, license (+8 more)

### Community 2 - "logParser.js"
Cohesion: 0.22
Nodes (7): aggregate(), fileCache, fs, LOG_ROOT_ENV, mean(), path, SAMPLE_ROOT

### Community 3 - "server.js"
Cohesion: 0.22
Nodes (5): readNewLines(), app, express, fs, path

### Community 4 - "connectLive"
Cohesion: 0.31
Nodes (9): appendLivePoint(), connectLive(), disconnectLive(), seedLive(), setLiveBadge(), setLiveFile(), setLiveReadout(), toggleLive() (+1 more)

### Community 5 - "applyTheme"
Cohesion: 0.38
Nodes (7): applyTheme(), chartColors(), cssVar(), initLiveChart(), rerenderModelCharts(), toggleTheme(), updateBarChart()

### Community 6 - "parseTextToData"
Cohesion: 0.33
Nodes (6): getDataForFile(), leafName(), parseLiveLines(), parseTextToData(), parseTs(), readTailSamples()

### Community 7 - "fetchData"
Cohesion: 0.33
Nodes (6): fetchData(), hideError(), setConnectionState(), showError(), showLoading(), toggleAutoRefresh()

### Community 8 - "updateDashboard"
Cohesion: 0.33
Nodes (6): fmt(), updateDashboard(), updateEvents(), updateModelTable(), updateSessionTable(), updateSourceFiles()

### Community 9 - "getPerformanceData"
Cohesion: 0.60
Nodes (5): findActiveLogFile(), getLogRoot(), getPerformanceData(), listDates(), listLogFiles()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `package.json` to `server.js`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Should `script.js` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Why does `getPerformanceData()` connect `getPerformanceData` to `logParser.js`, `server.js`, `parseTextToData`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.1323529411764706 - nodes in this community are weakly interconnected._