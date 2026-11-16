# Bug Fixing and Validation Standard

## Objective

Fix verified defects without introducing unrelated changes. A bug fix must be based on reproducible evidence or a clearly identified failure path.

## Bug report format

For each issue record:

- **Title**
- **Severity:** critical / high / medium / low
- **Affected area**
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Evidence:** error output, screenshot description, or code path
- **Likely cause**
- **Proposed minimal fix**
- **Regression risk**

Do not label an issue as confirmed if it has not been reproduced or traced to a clear cause.

## UI validation matrix

| Area | Checks |
|---|---|
| Layout | Alignment, spacing, consistent widths, no unintended overlap |
| Responsive | Desktop, laptop, tablet, narrow mobile |
| Themes | Light and dark text, borders, charts, status indicators |
| Controls | Labels, focus, keyboard use, disabled/loading states |
| Charts | Correct dimensions, readable labels, no duplicate instances |
| Data states | Normal, empty, missing, malformed, loading, error |
| Motion | Reduced motion supported; no unnecessary continuous effects |
| Accessibility | Semantic headings, accessible names, visible focus |

## Functional regression matrix

- Initial dashboard load.
- Date list and selected-date filter.
- All-date aggregation.
- Summary metrics and formatting.
- Per-model breakdown.
- Chart data and rendering.
- SSE connection and incoming events.
- SSE disconnect and reconnect behavior.
- Online/busy/offline status.
- Auto-refresh enabled and disabled.
- Theme persistence after reload.
- PowerShell report workflow, if changes could affect shared files or assumptions.

## Technical checks

Inspect `package.json` before choosing commands. Use only scripts that exist.

Potential checks, only when supported:

```bash
node --check server.js
node --check logParser.js
node --check public/script.js
npm test
npm run lint
npm run build
```

Do not report a command as executed if it was not run. Do not install dependencies just to make a check pass without approval.

## Diff review

Before completion:

- Inspect `git diff --check`.
- Inspect `git diff --stat`.
- Inspect the full diff for unrelated edits.
- Inspect `git status`.
- Confirm no secrets, generated reports, logs, or local configuration were added accidentally.
- Confirm user changes were preserved.

## Final status vocabulary

Use only:

- **PASS** — check was actually performed and passed.
- **FAIL** — check was performed and failed.
- **NOT TESTED** — no test was performed.
- **BLOCKED** — the check could not be performed; explain why.

A task is not complete merely because the code was written.
