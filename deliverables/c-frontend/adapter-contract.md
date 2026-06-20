# C Frontend Adapter Contract

## Purpose

C 组页面壳优先消费 `window.ARY_C_FRONTEND_ADAPTER`，也兼容 E 侧已经存在的 `window.ARY_ASSEMBLED_VIEW` / `window.ARY_RUNTIME_VIEW`；这些输入缺失时才回落到本地 `window.ARY_SAMPLE_DATA` demo 数据。E 组可以把 `runtime-data/assembled-view.json`、D 组 authority mock、B 组发布治理和 A 组公开骑行摘要归一化后喂给本契约。

## Minimum adapter input

The adapter may receive one assembled object with these fields:

1. `races: RaceSummary[]`
2. `liveProjections: LiveProjectionView[]`
3. `works: PublishedWorkView[]`
4. `awards | results: PublishedResultView[]`
5. `reviews: PublishedReviewView[]`
6. `profiles: PublicRiderProfileView[]`
7. `caStatuses: CAConnectionStatusView[]`
8. `dashboard: DashboardOverview`
9. `projectionStatuses: ProjectionStatus[]`
10. `publishedArtifacts: PublishedArtifactStatus[]`

Legacy demo input may also include GRS-002 Jumbotron data profiles under `deliverables/c-frontend/app-shell/legacy-reuse/grs002-jumbotron/data/`.

## Required adapter output methods

C shell expects E or the page adapter to provide these methods:

1. `getFeaturedRace(): RaceSummary | null`
2. `getLiveRaces(): RaceSummary[]`
3. `getRace(raceId): RaceSummary | null`
4. `getRaceWorks(raceId): PublishedWorkView[]`
5. `getPublicWorks(): PublishedWorkView[]`
6. `getWork(workId): PublishedWorkView | null`
7. `getRaceProjection(raceId): LiveProjectionView | null`
8. `getRaceResults(raceId): PublishedResultView | null`
9. `getRaceReview(raceId): PublishedReviewView | null`
10. `getRiderProfile(riderId): PublicRiderProfileView | null`
11. `getScreenModel(raceId, mode): ScreenDisplayView`
12. `getVisibilityReason(resource): string`

## Public filtering rules

1. Works: only `visibility = public` and `status/publicationStatus = published` may be returned by public methods.
2. Results: only published Award / Report / leaderboard read model may be returned.
3. Review: only published review summary may be returned.
4. Profile: only public profile fields and public evidence summaries may be returned.
5. Projection: may be returned only for process display and must not be treated as final result.
6. Raw CA Session, raw RidingRecord, private source files, internal judge drafts and hidden resources must never be returned to public pages.

## Legacy reuse mapping

### GRS-001 Public Yard

Reusable for Home / Race Page / Cooperation / Results fallback:

- `grs001-public-yard/public_disclosures.json` → public race disclosure and lifecycle labels.
- `grs001-public-yard/races.json` → race discovery fallback.
- `grs001-public-yard/leaderboard_projection.json` → old public leaderboard sample; may be used only as legacy demo data and must be marked as projection unless converted to PublishedResultView.
- `grs001-public-yard/users.json` and `teams.json` → public rider/team demo labels only.

### GRS-002 Jumbotron

Reusable for Live Hall / Screen Display:

- `runtime/trackRuntime.js` → centerline sampling and HorsePose calculation.
- `runtime/jumbotronAdapter.js` → DCR RaceSnapshot to Jumbotron runtime input adapter.
- `data/curated-race-snapshot.json`, `smoke-race-snapshot-8.json`, `smoke-race-snapshot-9-coverage.json` → demo projection profiles.
- `assets/real-explicit-closed-course/track.profile.json` and `background.webp` → confirmed track geometry and visual background.
- `assets/sprites/rider3_*.webp` → rider sprite assets.

## ScreenDisplayView shape

```json
{
  "race": {},
  "mode": "live | leaderboard | works | announcement | fallback",
  "title": "string",
  "metrics": [{ "label": "string", "value": "string" }],
  "projection": {},
  "trackProfile": {},
  "entries": [],
  "fallbackReason": "string | null"
}
```

## Executable route / CTA contract

The prototype exposes a C-owned route boundary on `window.ARY_C_FRONTEND` so E can drive page state without monkey patching DOM handlers or internal render functions.

```js
window.ARY_C_FRONTEND.applyRouteState({
  page: "home | race | live | works | results | review | rider | cooperation | screen",
  raceId: "bay-area-happy-trip",
  workId: "work-gba-wander",
  riderId: "rider-mira",
  resultsRaceId: "genesis-dogfood-race",
  workFilter: "public | featured | awarded | unavailable",
  screenMode: "live | leaderboard | announcement | fallback",
  homeRacePinned: true
}, { syncUrl: true, replace: false });
```

Available methods:

1. `applyRouteState(state, options)` renders the requested page state and optionally writes the product-shell URL.
2. `applyPath(path, options)` parses a route-map path such as `/works?raceId=genesis-dogfood-race&filter=awarded` or `/public/?raceId=smart-investment-analyst#home` and applies it.
3. `parsePath(path)` returns the route state without rendering.
4. `getRouteState()` returns the current explicit C route state.
5. `getUrlForState(state)` returns the product-shell path for a state.
6. `pauseHomeCarousel()` pins the current home race and stops automatic rotation.
7. `resumeHomeCarousel()` allows the home carousel to rotate again while Home is active.

When C state changes, the prototype dispatches `ary:c-frontend-route-change` with `{ state, url }` in `event.detail`.

Route ownership rules:

1. External `raceId` wins over Home carousel state.
2. `homeRacePinned: true` prevents automatic Live Race rotation from overwriting URL or page state.
3. Works filter, Work detail, Rider profile, Results / Review race, Live Hall, and Screen mode all have explicit state keys and must not be inferred from the currently visible DOM.
4. CTA buttons carry explicit route data (`data-route-race-id`, `data-work-id`, `data-rider-id`, `data-work-filter`, `data-results-race`, `data-screen-mode`) and call the same route boundary used by E.

## Integration expectation

E should be able to replace the assembled input without editing C page DOM structure. If an input field is absent, the adapter must return an explicit empty / unavailable model so the page can render documented fallback UI. E should use `window.ARY_C_FRONTEND` for route and CTA state instead of wrapping `renderHomeRace`, `renderPublicRaceContext`, or raw click handlers.
