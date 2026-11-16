# Master Upgrade Plan

## Objective

Upgrade the Analysis of Local LLM dashboard into a polished, maintainable, responsive monitoring interface. The first priority is a mature homepage redesign that visually belongs to the existing dashboard theme. Subsequent improvements must be delivered one feature at a time.

## Verified baseline from the repository README

The project is described as a self-contained Node.js/Express + Chart.js dashboard with a PowerShell reporting utility. The dashboard reads LM Studio/Bionic server logs and provides:

- Date selection / all-date view.
- Per-model and overall tokens-per-second metrics.
- Live throughput feed using Server-Sent Events.
- Model breakdown and sample counts.
- Summary metrics and status indicator.
- Optional five-second polling.
- Light and dark themes.

These features are preservation requirements unless the user explicitly approves a change.

## Non-goals

- Do not migrate to React, Vue, TypeScript, or another framework merely for visual polish.
- Do not replace Express or Chart.js without a demonstrated technical reason.
- Do not redesign the entire application in one pass.
- Do not add mock metrics to production views.
- Do not change the log format or API contract as part of the homepage task.
- Do not add dependencies for cosmetic convenience.

## Delivery phases

| Phase | Scope | Expected result |
|---|---|---|
| 0 | Baseline audit | Verified architecture, scripts, routes, current UI issues |
| 1 | Design alignment | Reusable visual rules based on existing dashboard theme |
| 2 | Homepage rework | Aligned, coherent, responsive homepage |
| 3 | UI bug fixes | Layout, theme, responsive, and interaction defects fixed |
| 4 | Feature improvements | One selected feature per task |
| 5 | Backend/API hardening | Only evidence-based fixes, preserving contracts |
| 6 | Final regression | Existing functionality and new features validated |

## Phase gates

Do not begin the next phase until:

1. The current phase has a written result.
2. The changed files and scope are clear.
3. Acceptance criteria are checked.
4. The user has reviewed the result or explicitly instructed continuation.

## Phase 0 — Baseline audit

Follow `01-BASELINE-AUDIT.md`. This phase is read-only. Do not edit application files.

## Phase 1 — Design alignment

Follow `02-DESIGN-SYSTEM.md`. Inspect and document the existing design tokens and dashboard patterns. Do not invent a separate design language.

## Phase 2 — Homepage rework

Follow `03-HOMEPAGE-REWORK.md`. This is the first implementation task. Keep the work focused on the homepage and directly related styles/scripts only.

## Phase 3 — Bug fixing and validation

Follow `05-BUGFIX-AND-VALIDATION.md`. Fix only verified issues, preferably one issue or tightly related group at a time.

## Phase 4 — Feature roadmap

Select one feature from `04-FEATURE-ROADMAP.md`. Use `06-FEATURE-TASK-TEMPLATE.md` to create the prompt for each feature.

## Definition of done

A task is complete only when:

- Its acceptance criteria are met.
- Existing functionality in its impact area still works.
- No unintended files or unrelated features were changed.
- Available checks were run and results are accurately reported.
- The diff has been reviewed.
- Known limitations are documented.
