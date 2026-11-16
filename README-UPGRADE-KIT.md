# Local LLM Dashboard Upgrade Kit

This kit provides an incremental, feature-by-feature plan for upgrading the **Analysis of Local LLM** dashboard with a local model in Bionic.

## Repository context verified from the public README

- Node.js / Express backend.
- Chart.js dashboard frontend.
- Main UI: `Node Interface/public/index.html`, `style.css`, `script.js`.
- Backend: `Node Interface/server.js`, `logParser.js`.
- Existing capabilities include date filtering, live Server-Sent Events (SSE), throughput metrics, model breakdown, theme switching, connection status, and optional polling.

The source files themselves have not yet been audited. The first task must inspect the actual working tree and confirm the current architecture before proposing edits.

## Where to put these files

Copy this kit into the repository root, preserving this structure:

```text
analysis-of-local-llm/
├── BIONIC_LOCAL_MODEL_SYSTEM_PROMPT.md
├── README-UPGRADE-KIT.md
└── docs/
    └── upgrade/
        ├── 00-MASTER-PLAN.md
        ├── 01-BASELINE-AUDIT.md
        ├── 02-DESIGN-SYSTEM.md
        ├── 03-HOMEPAGE-REWORK.md
        ├── 04-FEATURE-ROADMAP.md
        ├── 05-BUGFIX-AND-VALIDATION.md
        └── 06-FEATURE-TASK-TEMPLATE.md
```

## Recommended execution order

1. Read `BIONIC_LOCAL_MODEL_SYSTEM_PROMPT.md` and `docs/upgrade/00-MASTER-PLAN.md`.
2. Run only the baseline audit in `01-BASELINE-AUDIT.md`. Do not modify application code during the audit.
3. Agree on the findings and the proposed homepage layout.
4. Implement the homepage rework using `03-HOMEPAGE-REWORK.md`.
5. Validate it using `05-BUGFIX-AND-VALIDATION.md`.
6. Move to one feature at a time using `04-FEATURE-ROADMAP.md` and `06-FEATURE-TASK-TEMPLATE.md`.

## Important operating rule

Do not ask the model to "upgrade everything" in one prompt. Give it one bounded task, review the diff, run the app and checks, then issue the next task. The model must stop after each feature and report what changed, what was tested, and what remains.

## Local model note

The intended model is **GPT-OSS 20B - MXFP4** running locally through Bionic. The prompts are deliberately explicit, bounded, and evidence-driven. Model output quality still depends on the actual context window, tool availability, and Bionic execution configuration.
