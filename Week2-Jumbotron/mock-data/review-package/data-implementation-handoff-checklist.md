# Jumbotron data implementation handoff checklist

Audience: cc-ARY implementation line, reviewed by cc-Jumbotron and cc-data.

Scope: this checklist covers narrow data consumption and debug evidence. It does not require cc-ARY to solve visual assets, Calibrator UI, short video production, or final visual overlap by data alone.

## 1. Data profiles

### `curated-full-12`

- Path: `PoC-GRS-001/jumbotron-mock-data/curated/race-snapshot.json`
- Entries: 12
- Default use: completeness and pressure evidence for `/jumbotron`.
- Good for: full KPI, full attention/messages, public boundary verification, stress-like visual review.
- Not for: the only video main-shot profile if 12 entries + bubbles + labels overload the screen.
- Expected validation: pass, 0 errors, 0 warnings.

### `smoke-8-visual-low-load`

- Path: `Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-8.json`
- Entries: 8
- Default use: low-load visual smoke, classroom screen, video main-shot candidate.
- Good for: visual clarity, label-bubble overlap review, main-stage composition.
- Not for: proving all 9 motion states or all 9 message types.
- Expected validation: pass, 0 errors, expected enum coverage warnings.

### `coverage-9-enum-complete`

- Path: `Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-9-coverage.json`
- Entries: 9
- Default use: debug/validator/technical explanation profile.
- Good for: proving all 9 motion states and all 9 message types are covered.
- Not for: lowest-load main visual screenshot.
- Expected validation: pass, 0 errors, 0 warnings.

## 2. Runtime or debug profile selection

Implement at least one visible way to identify which data profile is being consumed:

- URL query such as `/jumbotron?debug=1&profile=smoke-8`.
- Debug panel field such as `dataProfileId`.
- Review tool selector if a URL-level switch is not desirable.

Required acceptance checks:

- The page/debug output states the active profile id.
- Counts match the profile:
  - full: 12 entries, 13 messages, 13 attentionItems.
  - smoke-8: 8 entries, 9 messages, 9 attentionItems.
  - coverage-9: 9 entries, 10 messages, 11 attentionItems.
- smoke-8 is never described as enum-complete.
- coverage-9 is never described as the lowest-load visual profile.

## 3. Debug mode fields

`/jumbotron?debug=1` or equivalent review output should show:

- `dataProfileId`
- `entryCount`
- `messageCount`
- `attentionItemCount`
- `motionStateCoverage`
- `messageTypeCoverage`
- `publicHiddenFields`
- `validatorStatus`

Recommended debug values:

```text
publicHiddenFields: remoteCockpitUrl, targetUrl
validatorStatus: pass / pass_with_expected_warnings / fail
```

Debug mode may show metadata about hidden fields, but must not reveal raw private URLs on the public-facing page.

## 4. Adapter mapping requirements

Each curated entry provides:

- `latestMessage`
- `latestMessageId`

The RaceSnapshot provides:

- `messages[]`

Adapter must resolve:

```text
entry.latestMessageId + raceSnapshot.messages[]
  -> entry.lastMessage?: RidingMessageSnapshot
```

Fallback if `latestMessageId` is absent or cannot be resolved:

```text
entry.latestMessage
  -> minimal lastMessage-like summary for tooltip/focus detail only
```

Recommended debug evidence:

```text
latestMessageId: msg-x
lastMessageResolved: true/false
lastMessage.type
lastMessage.displayMode
```

Acceptance checks:

- A displayed/focused message can be traced back to `latestMessageId` and `messages[]`.
- Missing/stale message ids degrade to `latestMessage` summary rather than breaking the entry card.
- The implementation does not treat `latestMessage` vs `lastMessage` as a data gap.

## 5. Public-hidden boundary

These fields may exist in data/model:

- `remoteCockpitUrl`
- `targetUrl`

Public page must not render raw URL values.

Allowed public behavior:

- Show a neutral entry label such as `Remote Cockpit`.
- Show that a drill-down exists without exposing the raw target.
- In debug, show `publicHiddenFields: remoteCockpitUrl,targetUrl` or `hidden: true` metadata.

Forbidden public behavior:

- Rendering raw `targetUrl`.
- Rendering raw `remoteCockpitUrl`.
- Rendering private local paths, complete session logs, complex diffs, or internal scoring criteria.

## 6. Validator commands and expected results

Full curated:

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js
```

Expected: pass, 0 errors, 0 warnings.

Smoke-8:

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-8.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
```

Expected: pass, 0 errors, expected enum coverage warnings.

Coverage-9:

```bash
node /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/validate-curated-mock-data.js /media/lemonhdl/Shared/Software_Engineering/ARY/Week2-Jumbotron/mock-data/review-package/smoke-race-snapshot-9-coverage.json /media/lemonhdl/Shared/Software_Engineering/ARY/PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json
```

Expected: pass, 0 errors, 0 warnings.

## 7. cc-data follow-up after cc-ARY implementation

When cc-ARY adds data profile/debug/adapter support, cc-data should re-check:

- Which profile the page actually consumes.
- Whether displayed counts match `data-scenario-manifest.json`.
- Whether motion/message coverage shown in debug matches validator outputs.
- Whether public-hidden fields are metadata-only and raw URLs remain hidden.
- Whether `lastMessage` can be traced from `latestMessageId + messages[]`.
- Whether smoke-8 is used only for low-load visual review, not enum coverage.
- Whether coverage-9 is used for coverage/debug, not claimed as the lowest-load main visual.

## 8. Out of cc-data narrow scope

These are not data completeness gaps:

- `background.webp`, `preview.png`, `source.prompt.md` visual asset completeness.
- Calibrator drag/edit UI, Validate panel interaction, Export button UX.
- Short video production.
- Final curve naturalness, checkpoint visual semantics, label-bubble overlap, and bubble clearance.

cc-data still provides the data evidence that lets cc-ARY and cc-Jumbotron validate those implementation/visual items.
