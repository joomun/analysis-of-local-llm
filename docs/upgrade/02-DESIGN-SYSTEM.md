# Phase 1 — Existing Dashboard Design Alignment

## Objective

Create a small, consistent set of UI rules by studying the existing dashboard. The homepage must look like a natural extension of the current dashboard theme.

## Inspect before defining

Review existing CSS variables, theme selectors, fonts, component styles, spacing, radii, borders, shadows, chart colors, and responsive breakpoints. The README describes a dark navy / teal / periwinkle visual direction with glass-like panels and light/dark themes; verify the actual CSS before reusing those details.

## Design rules

### Layout and alignment

- Use one consistent page container and content width.
- Align the header, page title, filters, metric cards, charts, and tables to the same grid.
- Use a consistent spacing scale rather than arbitrary margins.
- Keep card padding and heading offsets consistent.
- Define intentional column proportions and responsive collapse behavior.
- Avoid fixed heights where content may vary.
- Prevent horizontal scroll except where a data table genuinely requires controlled horizontal scrolling.

### Typography

- Use the existing font stack unless there is a clear defect.
- Define consistent styles for page title, section heading, card label, metric value, helper text, and table content.
- Keep line heights and weights readable.
- Avoid excessive uppercase labels, tiny text, and decorative typography that harms readability.

### Components

Reuse consistent styles for:

- Page header and section headings.
- Summary metric cards.
- Filter controls.
- Chart panels.
- Data tables.
- Status indicators.
- Buttons and icon buttons.
- Empty, loading, and error states.

### Color and themes

- Reuse existing CSS variables where possible.
- Ensure text, borders, charts, and status colors work in both themes.
- Do not use color as the only way to communicate state.
- Check contrast for muted labels and disabled controls.
- Avoid introducing isolated hard-coded colors.

### Motion and performance

- Use short, subtle transitions only where they clarify interaction.
- Respect reduced-motion preferences.
- Avoid heavy blur, continuous animated backgrounds, and large animated shadows.
- Do not add an animation library for simple transitions.

## Required output

Produce a brief design specification listing:

- Existing tokens to retain.
- Missing tokens that are genuinely required.
- Grid/container rules.
- Typography hierarchy.
- Shared component patterns.
- Theme requirements.
- Responsive breakpoints based on the existing project.
- Performance/accessibility constraints.

Do not implement the homepage in this phase unless the user explicitly combines the approval and implementation step.
