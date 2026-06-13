# Jumbotron mock-data validation results

Validated at: 2026-06-12T15:42Z

Generated evidence:

- `data-profile-evidence.json`
- `last-message-mapping-evidence.json`
- `data-side-evidence-summary.md`

Runtime evidence integration:

- `/jumbotron?profile=full|smoke-8|coverage-9` selects the same three data profiles.
- `/jumbotron?debug=1&profile=...` renders data profile, counts, coverage, public-hidden, validator status, and lastMessage mapping evidence.
- `/api/jumbotron-data-evidence?profile=full|smoke-8|coverage-9` returns the same evidence as JSON and rejects invalid profiles instead of silently falling back.
- Public page, debug panel, bubble API, and evidence API expose `remoteCockpitUrl` / `targetUrl` only as field names, counts, or booleans.

Generator:

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/generate-data-side-evidence.js
```

## Full curated 12 entries

Command:

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js
```

Result:

```json
{
  "status": "pass",
  "errors": [],
  "warnings": [],
  "counts": {
    "entries": 12,
    "messages": 13,
    "attentionItems": 13,
    "lanes": 12
  }
}
```

Use: full completeness and pressure evidence.

## Smoke-8 visual low-load subset

Command:

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-8.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
```

Result:

```json
{
  "status": "pass",
  "errors": [],
  "warnings": [
    "motionState not covered: slowed",
    "motionState not covered: pit_stop",
    "motionState not covered: takeover",
    "message type not covered: takeover",
    "message type not covered: pit_stop"
  ],
  "counts": {
    "entries": 8,
    "messages": 9,
    "attentionItems": 9,
    "lanes": 12
  }
}
```

Use: low-load visual smoke, classroom screen, and video main-shot candidate.

Interpretation: the warnings are expected because smoke-8 is intentionally not the enum-coverage scenario. It must not be used to prove all 9 motion states or all 9 message types.

## Coverage-9 enum-complete subset

Command:

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-9-coverage.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
```

Result:

```json
{
  "status": "pass",
  "errors": [],
  "warnings": [],
  "counts": {
    "entries": 9,
    "messages": 10,
    "attentionItems": 11,
    "lanes": 12
  }
}
```

Use: enum coverage evidence for all motion states and message types.
