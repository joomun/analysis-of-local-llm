# Phase 0 — Baseline Audit (Read-only)

## Objective

Understand the actual working tree before proposing or making changes. This audit must not modify application files.

## Audit checklist

### A. Environment and repository state

- Confirm the current working directory.
- Confirm operating system, Node.js version, npm version, and Git availability.
- Inspect `git status` and current branch.
- Identify uncommitted user changes and do not overwrite them.
- Confirm the actual project root and the `Node Interface` directory.

### B. Project structure

Inspect at minimum:

- `Node Interface/package.json`
- `Node Interface/server.js`
- `Node Interface/logParser.js`
- `Node Interface/public/index.html`
- `Node Interface/public/style.css`
- `Node Interface/public/script.js`
- `Node Interface/README.md`
- Existing tests, assets, configuration, and lockfiles if present.

Do not assume every listed file still exists or has the same contents.

### C. Existing functionality

Document how each currently works:

- Initial dashboard load.
- Date filter and all-date behavior.
- Summary metric calculation and display.
- Throughput chart creation and updates.
- Model breakdown rendering.
- SSE connection, reconnection, and error state.
- Auto-refresh behavior and cleanup.
- Theme persistence and initial theme selection.
- Loading, empty, and error states.
- PowerShell report workflow and its relationship, if any, to the dashboard.

### D. Backend/API contracts

Record actual routes, methods, query parameters, response structures, and error responses. Confirm whether the public README matches the implementation.

Do not change routes or response structures during this audit.

### E. UI review

Inspect the current homepage at available viewport sizes. Record specific evidence for:

- Misalignment between sections and cards.
- Inconsistent spacing, padding, or widths.
- Typography hierarchy and readability.
- Header and navigation alignment.
- Chart/container sizing.
- Responsive overflow or clipping.
- Theme inconsistencies.
- Unclear labels or controls.
- Accessibility issues.
- Expensive visual effects or avoidable rendering work.

Do not report a visual defect unless it is observed.

### F. Quality baseline

- Inspect existing npm scripts.
- Identify existing tests, linting, and syntax-check commands.
- Run only safe, available checks.
- Record failures that existed before changes.
- Do not install or update dependencies.

## Required audit output

Produce a concise report with:

1. Verified environment and project root.
2. Actual file tree relevant to the dashboard.
3. Current architecture and data flow.
4. Existing functionality inventory.
5. API/SSE contract summary.
6. UI findings grouped by severity.
7. Existing tests and baseline results.
8. Risks and unknowns.
9. Recommended small implementation sequence for the homepage.
10. Exact files expected to change in Phase 2.

## Completion gate

Stop after producing the audit. Do not implement fixes or redesign the homepage in the same task. Wait for the user to approve the findings and implementation scope.
