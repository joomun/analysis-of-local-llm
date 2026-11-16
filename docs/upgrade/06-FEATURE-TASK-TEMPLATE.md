# Feature Task Prompt Template

Copy this template into Bionic for each individual feature. Replace the bracketed values. Do not combine multiple roadmap features into one request.

---

You are working on the Analysis of Local LLM dashboard in the current Bionic workspace. Follow `BIONIC_LOCAL_MODEL_SYSTEM_PROMPT.md` and the project instructions in `docs/upgrade/`.

## Task

Implement exactly this feature:

**Feature:** [ONE FEATURE NAME]

**User problem:** [WHAT PROBLEM DOES IT SOLVE?]

**Expected behavior:** [DESCRIBE THE REQUIRED BEHAVIOR]

## Scope

**Allowed areas/files:** [LIST KNOWN FILES OR SAY "INSPECT AND PROPOSE THE MINIMUM SET"]

**Out of scope:**
- Any unrelated feature.
- Broad refactoring.
- Framework migration.
- Dependency additions unless I approve them.
- API contract changes unless explicitly required and approved.
- Replacing real log data with mock data.

## Mandatory steps

1. Inspect the current implementation and relevant dependencies before editing.
2. Confirm the actual file paths and current Git working-tree state.
3. Explain the current behavior and the smallest safe change.
4. Identify expected files to change and acceptance criteria.
5. If the scope is ambiguous or requires a breaking change, stop and ask before editing.
6. Implement only this feature.
7. Preserve existing functionality and design conventions.
8. Run relevant available checks; do not invent scripts or claim unrun tests passed.
9. Inspect the final diff for unrelated or destructive changes.
10. Report the result and stop.

## Acceptance criteria

- [ ] [CRITERION 1]
- [ ] [CRITERION 2]
- [ ] Existing related functionality remains operational.
- [ ] Both themes are considered where relevant.
- [ ] Responsive behavior is checked where relevant.
- [ ] Validation results are reported honestly.
- [ ] No unrelated files or features were changed.

## Required response

Return:
1. Summary.
2. Files changed and why.
3. Acceptance criteria status.
4. Commands/checks actually run and results.
5. Known limitations or risks.
6. Suggested next feature (do not implement it).

**Important:** Do not proceed to another feature. Wait for my next instruction.
