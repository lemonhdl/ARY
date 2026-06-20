# C Frontend App Shell

This directory contains C group frontend shell materials for GRS-003.

## Current contents

- `prototype/`: runnable Week3 frontend prototype copied from `design-prototype/`. It includes Home / Race / Live / Works / Work Detail / Results / Review / Rider / Cooperation / Login / Console / Screen Display.
- `legacy-reuse/grs001-public-yard/`: reusable GRS-001 public disclosure data and Public Yard boundary notes.
- `legacy-reuse/grs002-jumbotron/`: reusable GRS-002 Jumbotron runtime, adapter, data profiles, confirmed track asset and rider sprites.

## How to open the prototype

Open `prototype/index.html` directly, or serve the folder with any static server.

The prototype uses `prototype/data/sample-races.js` as a browser bridge, so it can run without a backend during C group review.

## Integration boundary

This app shell is C-owned. E should use `../adapter-contract.md`, `../route-map.json`, and `../page-dependencies.json` to wire the shell into the single-machine Web app without changing page structure.

`legacy-reuse/` is reusable proof material, not the final authority data source. D's `authority-mock.json` and E's assembled runtime view should replace these demo inputs during integration.
