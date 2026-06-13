# Adapter lastMessage mapping note

## Problem

The three core documents use two compatible names for entry-level latest message data:

- 信息架构 / Race Live data shape: `latestMessage` and `latestMessageId` on each Racing Entry.
- 子系统 runtime contract: `lastMessage?: RidingMessageSnapshot` on `RacingEntrySnapshot`.

This is not a mock-data gap. It is an adapter mapping point.

## Current data

Each curated entry includes:

- `latestMessage`: short public summary for the entry.
- `latestMessageId`: id linking to `messages[]`.

The RaceSnapshot also includes full `messages[]` objects with:

- `messageId`
- `entryId`
- `source`
- `type`
- `severity`
- `summary`
- `createdAt`
- `displayMode`
- `targetUrl` marked as public-hidden.

## Required adapter behavior

Adapter should resolve:

```text
entry.latestMessageId + raceSnapshot.messages[]
  -> entry.lastMessage?: RidingMessageSnapshot
```

Fallback if `latestMessageId` is missing or stale:

```text
entry.latestMessage
  -> minimal lastMessage-like summary for tooltip/focus detail only
```

Public rendering must not expose raw `targetUrl`.

## Debug recommendation

`/jumbotron?debug=1` or equivalent debug view should show:

```text
latestMessageId: msg-x
lastMessageResolved: true/false
lastMessage.type
lastMessage.displayMode
publicHiddenFields: targetUrl, remoteCockpitUrl
```

This prevents reviewers from treating `latestMessage` vs `lastMessage` as a data completeness error.
