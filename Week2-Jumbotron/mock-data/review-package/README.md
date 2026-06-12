# Jumbotron mock-data review package

This package is for cc-data / cc-Jumbotron / cc-ARY review of narrow Jumbotron data coverage. It excludes visual asset completeness.

## Files

- `field-mapping-report.json`: maps source document fields to curated mock-data fields, marked as direct / derived / synthetic / public-hidden.
- `smoke-race-snapshot-8.json`: 8-entry RaceSnapshot subset for stable smoke review and lower visual load.
- `smoke-race-snapshot-9-coverage.json`: 9-entry subset that covers all 9 motion states while staying lighter than the 12-entry full set.
- `validate-curated-mock-data.js`: repeatable data-only validation script.

- `rubric-data-coverage-report.json`: maps the new GRS-002 rubric data-related lines to current mock-data evidence.

- `data-utilization-plan-by-rubric.md`: line-by-line plan for using data to support the latest GRS-002 rubric.

- `data-scenario-manifest.json`: explains full / smoke-8 / coverage-9 usage and validation expectations.

- `adapter-last-message-mapping.md`: explains `latestMessage/latestMessageId/messages[] -> lastMessage` adapter mapping.
- `validation-results.md`: records full / smoke-8 / coverage-9 validation outputs and expected smoke-8 warnings.
- `data-implementation-handoff-checklist.md`: concise cc-ARY implementation checklist for profile selection, debug fields, adapter mapping, public-hidden boundary, and validator expectations.
- `generate-data-side-evidence.js`: repeatable cc-data generator for data profile/debug evidence and lastMessage mapping evidence.
- `data-profile-evidence.json`: generated profile counts, coverage, public-hidden metadata, validator status, and debug contract fields.
- `last-message-mapping-evidence.json`: generated per-entry `latestMessageId + messages[] -> lastMessage` resolution evidence and fallback checks.
- `data-side-evidence-summary.md`: human-readable summary of the generated data-side evidence.
- Runtime integration in `PoC-GRS-001/src/server.js`: `/jumbotron?profile=full|smoke-8|coverage-9`, `/jumbotron?debug=1&profile=...`, and `/api/jumbotron-data-evidence?profile=...` consume the same profile contract.

## Runtime URLs

```text
/jumbotron
/jumbotron?profile=full
/jumbotron?profile=smoke-8
/jumbotron?profile=coverage-9
/jumbotron?debug=1&profile=full
/jumbotron?debug=1&profile=smoke-8
/jumbotron?debug=1&profile=coverage-9
/api/jumbotron-data-evidence?profile=full
/api/jumbotron-data-evidence?profile=smoke-8
/api/jumbotron-data-evidence?profile=coverage-9
```

The public page, debug panel, bubble API, and data evidence API must not render raw `remoteCockpitUrl` or `targetUrl` values; they only expose hidden-field names, counts, or booleans.

## Run

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-8.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-9-coverage.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/generate-data-side-evidence.js
```

## Scope

Narrow data scope includes Competition, KPI, Racing Entry, Riding Message, Attention Item, progress, token/cost, risk, state, and adapter input fields. Visual assets such as background.webp, preview.png, and source.prompt.md are out of scope for this data package.
