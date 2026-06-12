# Jumbotron data-side evidence summary

Generated at: 2026-06-12T15:42:36.858Z

## Files

- `generate-data-side-evidence.js`: repeatable generator for profile/debug evidence and lastMessage mapping evidence.
- `data-profile-evidence.json`: profile counts, coverage, public-hidden field metadata, validator status, and debug contract fields.
- `last-message-mapping-evidence.json`: per-entry latestMessageId -> lastMessage resolution evidence and fallback check.

## Profile status

- curated-full-12: pass; entries=12, messages=13, attentionItems=13; motionComplete=true; messageComplete=true
- smoke-8-visual-low-load: pass_with_expected_warnings; entries=8, messages=9, attentionItems=9; motionComplete=false; messageComplete=false
- coverage-9-enum-complete: pass; entries=9, messages=10, attentionItems=11; motionComplete=true; messageComplete=true

## Adapter mapping status

- curated-full-12: resolved=12/12, fallbackUsed=0, syntheticMissingIdFallsBack=true
- smoke-8-visual-low-load: resolved=8/8, fallbackUsed=0, syntheticMissingIdFallsBack=true
- coverage-9-enum-complete: resolved=9/9, fallbackUsed=0, syntheticMissingIdFallsBack=true

## Public-hidden boundary

Evidence files report `remoteCockpitUrl` and `targetUrl` only as hidden field names, counts, or booleans. They do not expose raw URL values.

## cc-data acceptance

- full curated is complete evidence and validates without warnings.
- smoke-8 is low-load visual evidence and validates with expected enum coverage warnings.
- coverage-9 is enum-complete debug/validator evidence and validates without warnings.
- lastMessage can be resolved from latestMessageId + messages[] for current profiles; missing ids fall back to latestMessage summary.
