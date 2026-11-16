# Phase 2 — Homepage UI Rework

## Goal

Mature the homepage UI so it is visually polished, precisely aligned, easy to scan, responsive, and consistent with the existing dashboard theme.

This is a focused homepage task, not a full application rewrite.

## Preconditions

Before implementation:

- Complete the baseline audit.
- Confirm the actual homepage entry point.
- Inspect the existing theme and design tokens.
- Identify user changes in the working tree.
- Agree on the proposed layout and files to modify.

If these preconditions are not met, stop and request the audit first.

## Homepage design objectives

### 1. Page frame

- Establish a consistent maximum content width and horizontal page padding.
- Align all major sections to the same left and right edges.
- Use a predictable vertical spacing rhythm.
- Ensure the page does not jump or overflow when data loads.

### 2. Header and page introduction

- Keep product identity and navigation consistent with the existing dashboard.
- Present a clear page title and concise supporting description.
- Align header controls and status indicators consistently.
- Avoid redundant titles or repeated descriptions.

### 3. Primary controls

- Group date selection, refresh controls, and relevant actions logically.
- Use consistent control heights, labels, spacing, and focus states.
- Make active, disabled, loading, and error states understandable.
- Keep controls usable at narrower widths.

### 4. Summary metrics

- Present key existing metrics in a balanced grid.
- Use consistent card padding, label placement, value alignment, and helper text.
- Keep number formatting consistent.
- Preserve the meaning and source of every metric.
- Do not invent new metrics or fake values.

### 5. Charts and supporting content

- Give charts clear headings and enough space to render.
- Align chart panels and supporting panels to a common grid.
- Prevent canvas stretching, clipping, and repeated chart initialization.
- Keep legends, labels, and tooltips readable in both themes.
- Preserve the existing model breakdown and live throughput behavior.

### 6. Live status and feedback

- Make online, busy, offline, loading, and error states clear.
- Do not imply the server is connected when the SSE connection has failed.
- Preserve the current SSE source and semantics.
- Avoid flashing or excessive animation for incoming samples.

### 7. Responsive behavior

Check at minimum:

- Wide desktop.
- Standard laptop.
- Tablet.
- Narrow mobile.

At each width verify:

- No accidental horizontal page overflow.
- No overlapping controls or text.
- Cards collapse in a logical order.
- Charts resize without distortion.
- Tables remain readable and accessible.
- Header actions remain reachable.

## Implementation constraints

- Reuse current HTML/CSS/JavaScript architecture.
- Do not add a frontend framework.
- Do not add dependencies for visual polish.
- Prefer CSS grid/flexbox and existing CSS variables.
- Keep JavaScript changes minimal unless a real interaction defect requires them.
- Preserve API routes, data structures, date filtering, live SSE, themes, and polling.
- Avoid broad selector changes that could damage other pages.
- Do not create decorative controls that do nothing.

## Acceptance criteria

- [ ] The homepage has a clear visual hierarchy.
- [ ] Header, title, filters, cards, charts, and supporting sections align to a consistent grid.
- [ ] Spacing, typography, control sizing, and card padding are consistent.
- [ ] Existing dashboard theme is retained and applied coherently.
- [ ] Light and dark themes remain legible.
- [ ] Desktop, laptop, tablet, and mobile layouts are usable.
- [ ] No overlapping, clipped, or unintentionally overflowing content.
- [ ] Existing metrics and their data sources are unchanged.
- [ ] Date filtering still works.
- [ ] Live SSE feed and connection status still work.
- [ ] Model breakdown still renders.
- [ ] Auto-refresh behavior is preserved.
- [ ] No unnecessary dependency was introduced.
- [ ] Changed files and validation results are reported accurately.

## Required completion report

List the files changed, summarize the design decisions, report each acceptance criterion as pass/fail/not tested, include commands actually run, and identify remaining issues. Stop after the homepage rework.
