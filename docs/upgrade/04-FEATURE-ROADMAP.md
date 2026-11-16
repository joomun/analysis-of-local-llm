# Feature Roadmap — One Feature per Task

This roadmap is a backlog, not permission to implement everything. The user selects or approves one feature at a time. First complete the homepage rework and its regression checks.

## Suggested order

### UI and usability

1. **Dashboard overview refinement** — improve information hierarchy and summary explanations without changing metric definitions.
2. **Model comparison view** — compare selected models across available dates using existing log data.
3. **Model detail view** — show a focused history and sample summary for one selected model.
4. **Filter UX refinement** — improve date selection and filter feedback while preserving existing behavior.
5. **Empty/loading/error states** — consistent messages and recovery guidance for unavailable or incomplete data.
6. **Table usability** — sorting or filtering only where supported by the data and useful to users.
7. **Accessibility pass** — keyboard navigation, focus visibility, labels, semantic structure, and contrast.

### Monitoring and analysis

8. **Historical trend analysis** — visualize throughput changes over time using verified log timestamps.
9. **Outlier/anomaly indicators** — flag unusual measurements using transparent, explainable rules.
10. **Session/run grouping** — only if the log format contains reliable session identifiers or a defensible grouping key.
11. **Export capability** — export currently filtered, real data with clear file format and timestamp.
12. **Log-source diagnostics** — explain missing folders, unreadable files, and parsing issues without exposing sensitive paths unnecessarily.

### Reliability and backend

13. **Parser robustness** — handle malformed, truncated, empty, and partially written logs.
14. **SSE resilience** — verify reconnect, cleanup, stale connection, and duplicate event behavior.
15. **API validation and error handling** — validate parameters and return consistent, safe errors.
16. **Performance optimization** — profile before optimizing; avoid speculative caching or complex abstractions.
17. **Automated tests** — add tests for parser behavior, API contracts, and critical frontend logic using the smallest suitable existing test setup.

## Feature selection rules

For each feature:

- State the user problem it solves.
- Confirm the required data exists.
- Define behavior and edge cases.
- Identify the smallest files and components affected.
- Preserve existing features and API contracts.
- Define acceptance criteria before coding.
- Implement and validate only that feature.
- Stop and wait for approval before starting another.

Do not implement roadmap items simply because they are listed here.
