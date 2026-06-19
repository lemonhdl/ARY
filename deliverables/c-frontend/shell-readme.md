# C Frontend Shell README

## Current status

This folder is the C group frontend handoff for GRS-003. It includes a runnable Week3 frontend shell under `app-shell/prototype/` and imports directly reusable outputs from GRS-001 and GRS-002 as local legacy reuse assets.

No git commit has been made by this migration.

## Scope

C group owns public-facing frontend display:

1. Home / Race Gallery
2. Race Page
3. Live Hall
4. Works / Work Page
5. Results
6. Review
7. Rider Profile
8. Cooperation
9. Screen Display

C group does not own real login, database, GitHub auth, CA ingestion, RidingRecord persistence, or final integration scripts.

## Reused GRS-001 assets

Path: `app-shell/legacy-reuse/grs001-public-yard/`

Reusable parts:

1. `public_disclosures.json` — public Race disclosure and lifecycle states.
2. `races.json` — Race discovery fallback.
3. `leaderboard_projection.json` — old public leaderboard/projection sample, useful for Results layout demo but not final Award source.
4. `teams.json`, `users.json` — public rider/team labels for demo profile mapping.
5. `PoC说明文档.md` — explanation of Public Yard / Private Race Source boundary.

How to use in Week3:

- Reuse its data sovereignty boundary: Organizer keeps source data; public frontend consumes only public disclosed data.
- Reuse public lifecycle labels as fallback copy for Race Page and Cooperation.
- Do not treat old leaderboard projection as Week3 final Results unless E transforms it into PublishedResultView.

## Reused GRS-002 assets

Path: `app-shell/legacy-reuse/grs002-jumbotron/`

Reusable parts:

1. `runtime/trackRuntime.js` — centerline sampling and HorsePose calculation.
2. `runtime/jumbotronAdapter.js` — RaceSnapshot to Jumbotron runtime input adapter.
3. `data/curated-race-snapshot.json` — curated live data profile.
4. `data/smoke-race-snapshot-8.json` — low-load screen smoke profile.
5. `data/smoke-race-snapshot-9-coverage.json` — enum coverage profile.
6. `assets/real-explicit-closed-course/track.profile.json` — confirmed track profile.
7. `assets/real-explicit-closed-course/background.webp` — confirmed track background.
8. `assets/sprites/rider3_run.webp`, `rider3_walk.webp`, `rider3_stay.webp` — rider sprites.
9. `GRS002-作品说明文档.md` — Jumbotron implementation explanation.

How to use in Week3:

- Live Hall and Screen Display can reuse the track runtime instead of canvas-only toy movement.
- Screen Display fallback mode can render a trusted track demo using the confirmed track asset.
- Calibrator concepts can inform future Screen Console / display calibration, but C should not move the full Calibrator into public output.

## Required handoff files

This directory now includes:

1. `handoff.manifest.json`
2. `route-map.json`
3. `page-dependencies.json`
4. `adapter-contract.md`
5. `fallback-rules.md`
6. `shell-readme.md`
7. `app-shell/prototype/`
8. `app-shell/legacy-reuse/`

## Integration notes for E

1. Discover this directory through `deliverables/c-frontend/handoff.manifest.json`.
2. Read route and page dependency files before wiring routes.
3. Treat `legacy-reuse/` as reusable C-owned demo/proof material, not as the final runtime authority source.
4. Replace legacy data with `runtime-data/assembled-view.json` when D/B/A handoffs are ready.
5. Do not edit C page structure just to switch data sources; use the adapter contract.

## Validation expectation

Minimal validation:

```bash
npm run validate
npm run assemble
```

Expected current limitation: A and D manifests may still be missing, so compatibility report can warn even when C manifest exists.
