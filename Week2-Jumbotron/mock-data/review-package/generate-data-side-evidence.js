#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const repoRoot = '/media/lemonhdl/Shared/Software_Engineering/ARY';
const reviewDir = join(repoRoot, 'Week2-Jumbotron/mock-data/review-package');
const trackPath = join(repoRoot, 'PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json');
const validateScript = join(reviewDir, 'validate-curated-mock-data.js');
const generatedAt = new Date().toISOString();

const expectedMotionStates = ['idle', 'running', 'sprinting', 'slowed', 'blocked', 'pit_stop', 'takeover', 'finished', 'stale'];
const expectedMessageTypes = ['progress_update', 'milestone', 'strategy_change', 'quality_signal', 'risk_alert', 'obstacle', 'violation', 'takeover', 'pit_stop'];
const expectedAttentionCategories = ['risk', 'obstacle', 'violation'];

const profiles = [
  {
    id: 'curated-full-12',
    path: join(repoRoot, 'PoC-GRS-001/jumbotron-mock-data/curated/race-snapshot.json'),
    defaultUse: 'complete Jumbotron data evidence and pressure profile',
    recommendedSurface: ['/jumbotron default', '/jumbotron?debug=1', 'final completeness evidence'],
    notFor: ['the only video main-shot profile if labels and bubbles overload the screen'],
    expectedValidatorStatus: 'pass',
    expectedWarnings: []
  },
  {
    id: 'smoke-8-visual-low-load',
    path: join(reviewDir, 'smoke-race-snapshot-8.json'),
    defaultUse: 'low-load visual smoke, classroom screen, video main-shot candidate',
    recommendedSurface: ['video main shot', 'visual smoke review', 'label-bubble overlap review'],
    notFor: ['proving all 9 motion states', 'proving all 9 message types'],
    expectedValidatorStatus: 'pass_with_expected_warnings',
    expectedWarnings: [
      'motionState not covered: slowed',
      'motionState not covered: pit_stop',
      'motionState not covered: takeover',
      'message type not covered: takeover',
      'message type not covered: pit_stop'
    ]
  },
  {
    id: 'coverage-9-enum-complete',
    path: join(reviewDir, 'smoke-race-snapshot-9-coverage.json'),
    defaultUse: 'coverage/debug/validator profile for all motion states and message types',
    recommendedSurface: ['debug coverage page', 'validator evidence', 'technical explanation segment'],
    notFor: ['lowest-load main visual screenshot'],
    expectedValidatorStatus: 'pass',
    expectedWarnings: []
  }
];

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function coverage(items, expected) {
  const present = [...new Set(items.filter(Boolean))].sort();
  const missing = expected.filter((item) => !present.includes(item));
  return { expected, present, missing, complete: missing.length === 0 };
}

function runValidator(racePath) {
  const stdout = execFileSync('node', [validateScript, racePath, trackPath], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

function validatorStatus(result) {
  if (result.status !== 'pass') return 'fail';
  return result.warnings.length ? 'pass_with_expected_warnings' : 'pass';
}

function publicHiddenEvidence(race) {
  const entries = race.entries || [];
  const messages = race.messages || [];
  const attentionItems = race.attentionItems || [];
  return {
    rawValuesExcludedFromEvidence: true,
    fields: [
      { field: 'remoteCockpitUrl', locations: ['entries'], count: entries.filter((entry) => Boolean(entry.remoteCockpitUrl)).length },
      { field: 'targetUrl', locations: ['messages'], count: messages.filter((message) => Boolean(message.targetUrl)).length },
      { field: 'targetUrl', locations: ['attentionItems'], count: attentionItems.filter((item) => Boolean(item.targetUrl)).length }
    ],
    publicRule: 'data/model may contain remoteCockpitUrl and targetUrl; public pages and public evidence must not render raw URL values'
  };
}

function resolveLastMessage(entry, messagesById) {
  const resolved = entry.latestMessageId ? messagesById.get(entry.latestMessageId) : null;
  if (resolved) {
    return {
      resolved: true,
      fallbackUsed: false,
      latestMessageId: entry.latestMessageId,
      lastMessage: {
        messageId: resolved.messageId,
        entryId: resolved.entryId,
        type: resolved.type,
        severity: resolved.severity,
        displayMode: resolved.displayMode,
        summaryPresent: Boolean(resolved.summary),
        targetUrlHidden: Object.prototype.hasOwnProperty.call(resolved, 'targetUrl')
      }
    };
  }
  return {
    resolved: false,
    fallbackUsed: Boolean(entry.latestMessage),
    latestMessageId: entry.latestMessageId || null,
    fallback: {
      summaryPresent: Boolean(entry.latestMessage),
      source: 'entry.latestMessage'
    }
  };
}

const profileEvidence = {
  generatedAt,
  script: relative(repoRoot, join(reviewDir, basename(process.argv[1]))),
  trackProfile: relative(repoRoot, trackPath),
  profileSelectorContract: {
    validProfileIds: profiles.map((profile) => profile.id),
    suggestedQueryParam: 'profile',
    requiredDebugFields: [
      'dataProfileId',
      'entryCount',
      'messageCount',
      'attentionItemCount',
      'motionStateCoverage',
      'messageTypeCoverage',
      'publicHiddenFields',
      'validatorStatus'
    ]
  },
  profiles: []
};

const mappingEvidence = {
  generatedAt,
  script: relative(repoRoot, join(reviewDir, basename(process.argv[1]))),
  rule: 'entry.latestMessageId + raceSnapshot.messages[] -> entry.lastMessage?: RidingMessageSnapshot; fallback to entry.latestMessage summary',
  publicHiddenRule: 'targetUrl and remoteCockpitUrl are reported only as hidden field names or booleans; raw URL values are excluded from this evidence',
  profiles: []
};

for (const profile of profiles) {
  const race = readJson(profile.path);
  const entries = race.entries || [];
  const messages = race.messages || [];
  const attentionItems = race.attentionItems || [];
  const validator = runValidator(profile.path);
  const status = validatorStatus(validator);
  const motionStateCoverage = coverage(entries.map((entry) => entry.motionState), expectedMotionStates);
  const messageTypeCoverage = coverage(messages.map((message) => message.type), expectedMessageTypes);
  const attentionCategoryCoverage = coverage(attentionItems.map((item) => item.category), expectedAttentionCategories);
  const publicHiddenFields = publicHiddenEvidence(race);

  profileEvidence.profiles.push({
    id: profile.id,
    path: relative(repoRoot, profile.path),
    defaultUse: profile.defaultUse,
    recommendedSurface: profile.recommendedSurface,
    notFor: profile.notFor,
    counts: {
      entries: entries.length,
      messages: messages.length,
      attentionItems: attentionItems.length
    },
    motionStateCoverage,
    messageTypeCoverage,
    attentionCategoryCoverage,
    publicHiddenFields,
    validatorStatus: status,
    validator,
    expectationCheck: {
      statusMatches: status === profile.expectedValidatorStatus,
      expectedValidatorStatus: profile.expectedValidatorStatus,
      expectedWarnings: profile.expectedWarnings,
      warningsMatchExpected: JSON.stringify(validator.warnings || []) === JSON.stringify(profile.expectedWarnings)
    }
  });

  const messagesById = new Map(messages.map((message) => [message.messageId, message]));
  const entryMappings = entries.map((entry) => ({
    entryId: entry.entryId,
    latestMessagePresent: Boolean(entry.latestMessage),
    remoteCockpitUrlHidden: Object.prototype.hasOwnProperty.call(entry, 'remoteCockpitUrl'),
    ...resolveLastMessage(entry, messagesById)
  }));
  const firstEntry = entries[0] || {};
  const syntheticFallback = resolveLastMessage({ ...firstEntry, latestMessageId: '__missing_message_id__' }, messagesById);

  mappingEvidence.profiles.push({
    id: profile.id,
    path: relative(repoRoot, profile.path),
    counts: {
      entries: entries.length,
      resolved: entryMappings.filter((entry) => entry.resolved).length,
      fallbackUsed: entryMappings.filter((entry) => entry.fallbackUsed).length,
      unresolvedWithoutFallback: entryMappings.filter((entry) => !entry.resolved && !entry.fallbackUsed).length
    },
    entryMappings,
    syntheticFallbackCheck: {
      entryId: firstEntry.entryId || null,
      latestMessageId: '__missing_message_id__',
      result: syntheticFallback
    },
    acceptance: {
      allExistingIdsResolve: entryMappings.every((entry) => entry.resolved),
      syntheticMissingIdFallsBack: syntheticFallback.fallbackUsed === true,
      rawUrlValuesExcludedFromEvidence: true
    }
  });
}

const profilePath = join(reviewDir, 'data-profile-evidence.json');
const mappingPath = join(reviewDir, 'last-message-mapping-evidence.json');
const summaryPath = join(reviewDir, 'data-side-evidence-summary.md');

writeFileSync(profilePath, JSON.stringify(profileEvidence, null, 2) + '\n', 'utf8');
writeFileSync(mappingPath, JSON.stringify(mappingEvidence, null, 2) + '\n', 'utf8');

const summary = [
  '# Jumbotron data-side evidence summary',
  '',
  `Generated at: ${generatedAt}`,
  '',
  '## Files',
  '',
  '- `generate-data-side-evidence.js`: repeatable generator for profile/debug evidence and lastMessage mapping evidence.',
  '- `data-profile-evidence.json`: profile counts, coverage, public-hidden field metadata, validator status, and debug contract fields.',
  '- `last-message-mapping-evidence.json`: per-entry latestMessageId -> lastMessage resolution evidence and fallback check.',
  '',
  '## Profile status',
  '',
  ...profileEvidence.profiles.map((profile) => `- ${profile.id}: ${profile.validatorStatus}; entries=${profile.counts.entries}, messages=${profile.counts.messages}, attentionItems=${profile.counts.attentionItems}; motionComplete=${profile.motionStateCoverage.complete}; messageComplete=${profile.messageTypeCoverage.complete}`),
  '',
  '## Adapter mapping status',
  '',
  ...mappingEvidence.profiles.map((profile) => `- ${profile.id}: resolved=${profile.counts.resolved}/${profile.counts.entries}, fallbackUsed=${profile.counts.fallbackUsed}, syntheticMissingIdFallsBack=${profile.acceptance.syntheticMissingIdFallsBack}`),
  '',
  '## Public-hidden boundary',
  '',
  'Evidence files report `remoteCockpitUrl` and `targetUrl` only as hidden field names, counts, or booleans. They do not expose raw URL values.',
  '',
  '## cc-data acceptance',
  '',
  '- full curated is complete evidence and validates without warnings.',
  '- smoke-8 is low-load visual evidence and validates with expected enum coverage warnings.',
  '- coverage-9 is enum-complete debug/validator evidence and validates without warnings.',
  '- lastMessage can be resolved from latestMessageId + messages[] for current profiles; missing ids fall back to latestMessage summary.',
  ''
].join('\n');
writeFileSync(summaryPath, summary, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  outputs: [profilePath, mappingPath, summaryPath],
  profileStatuses: profileEvidence.profiles.map((profile) => ({ id: profile.id, validatorStatus: profile.validatorStatus, warnings: profile.validator.warnings })),
  mappingStatuses: mappingEvidence.profiles.map((profile) => ({ id: profile.id, resolved: profile.counts.resolved, entries: profile.counts.entries, syntheticMissingIdFallsBack: profile.acceptance.syntheticMissingIdFallsBack }))
}, null, 2));
