# C Frontend Fallback Rules

## General rule

Fallback UI must explain absence of public data without leaking private source data. It may use legacy GRS-001 / GRS-002 demo assets only when the page is clearly in prototype or demo mode.

## Projection missing

Affected pages: Live Hall, Screen Display.

1. Do not invent live events.
2. Show `Projection unavailable` or `Stable fallback` state.
3. Prefer fallback order:
   1. latest stable projection from adapter;
   2. static race announcement;
   3. public works showcase;
   4. GRS-002 Jumbotron smoke profile for demo-only screen proof.
4. Never expose raw CA Session, terminal logs, raw RidingRecord or internal source refs.

## Results unpublished

Affected pages: Race Page, Results, Screen Display leaderboard mode.

1. Disable or de-emphasize Results entry on Race Page.
2. Results page shows not-yet-published state.
3. Do not derive final rankings from LiveProjectionView.
4. GRS-001 `leaderboard_projection.json` may be used only as legacy demo sample and must not be labelled as final Award unless transformed by E into PublishedResultView.

## Review unpublished

Affected pages: Race Page, Review.

1. Disable or de-emphasize Review entry on Race Page.
2. Review page states that public review_summary is not published.
3. Do not show judge drafts, internal comments or report drafts.

## Work is not public

Affected pages: Works, Work Page, Rider Profile.

1. Public Works list filters out `private`, `review`, `hidden`, and unpublished works.
2. Direct Work Page route for non-public work shows unavailable state.
3. It may explain that review/internal works are visible only to authorized Judge / Organizer views.
4. It must not show repo private links, raw CA evidence, private RidingRecord or hidden submission details.

## Rider profile is not public

Affected pages: Rider Profile, Home, Work Page.

1. Hide non-public profile fields.
2. Show public profile unavailable state when profile is private or missing.
3. Public profile may show public works, public awards and public evidence summaries only.
4. Raw RidingRecord and raw CA Session stay private.

## Screen display fallback

Affected page: Screen Display.

1. Screen Display is output-only.
2. Demo controls, mode buttons and calibration controls stay outside the output surface.
3. In demo mode, GRS-002 `trackRuntime.js`, `track.profile.json`, `background.webp`, and rider sprites can render a proof screen.
4. If no projection exists, use static announcement / works showcase / stable track demo instead of fake live rankings.

## Legacy reuse boundary

1. GRS-001 is reused for public disclosure and data sovereignty proof.
2. GRS-002 is reused for Jumbotron / track-runtime / Calibrator proof.
3. Legacy assets are not the Week3 authority data source; they are fallback/demo materials until D and E provide assembled runtime views.
4. Any reused data must still pass Week3 publication and visibility rules.
