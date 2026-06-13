#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = '/media/lemonhdl/Shared/Software_Engineering/ARY';
const racePath = process.argv[2] || join(repoRoot, 'PoC-GRS-001/jumbotron-mock-data/curated/race-snapshot.json');
const trackPath = process.argv[3] || join(repoRoot, 'PoC-GRS-001/jumbotron-mock-data/curated/track.profile.json');
const race = JSON.parse(readFileSync(racePath, 'utf8'));
const track = JSON.parse(readFileSync(trackPath, 'utf8'));
const entries = race.entries || [];
const messages = race.messages || [];
const attentionItems = race.attentionItems || [];
const errors = [];
const warnings = [];

function requireField(object, field, label) {
  if (!Object.prototype.hasOwnProperty.call(object || {}, field)) errors.push(label + ' missing ' + field);
}
function requireEvery(items, field, label) {
  items.forEach((item, index) => requireField(item, field, label + '[' + index + ']'));
}
function inRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) errors.push(label + ' out of range ' + min + '-' + max + ': ' + value);
}

['competitionId','title','subtitle','theme','organizer','liveStatus','currentPhase','currentRound','nextPhase','elapsedTime','systemTime'].forEach((field) => requireField(race.competition, field, 'competition'));
['completionRate','totalTokens','activeRiders','onlineRiders','activeCockpits','codexTokens','claudeTokens','codexShare','claudeShare','riskCount','obstacleCount','violationCount'].forEach((field) => requireField(race.kpi, field, 'kpi'));
['entryId','displayName','riderName','projectName','rank','rankDelta','score','overallProgress','roundProgress','phaseProgress','tokenCost','primaryCA','codexUsage','claudeUsage','riskLevel','motionState','latestMessage','remoteCockpitUrl','caProvider','costTokens','costUsd','obstacleCount','violationCount','updatedAt','currentPhase','status','laneId'].forEach((field) => requireEvery(entries, field, 'entry'));
['messageId','entryId','source','type','severity','summary','createdAt','displayMode','targetUrl'].forEach((field) => requireEvery(messages, field, 'message'));
['itemId','entryId','category','severity','summary','status','createdAt','targetUrl'].forEach((field) => requireEvery(attentionItems, field, 'attention'));
['trackId','backgroundAsset','viewBox','designSize','centerlinePath','startLine','finishLine','checkpoints','laneOffsets','safeZones'].forEach((field) => requireField(track, field, 'track'));

entries.forEach((entry) => {
  inRange(Number(entry.overallProgress), 0, 100, entry.entryId + '.overallProgress');
  inRange(Number(entry.roundProgress), 0, 100, entry.entryId + '.roundProgress');
  inRange(Number(entry.phaseProgress), 0, 100, entry.entryId + '.phaseProgress');
  if (!['none','low','medium','high'].includes(entry.riskLevel)) errors.push(entry.entryId + '.riskLevel invalid ' + entry.riskLevel);
  if (!['claude','codex','other'].includes(entry.caProvider)) errors.push(entry.entryId + '.caProvider invalid ' + entry.caProvider);
  if (!['PRD','DEV','REL','OPS','PM'].includes(entry.currentPhase)) errors.push(entry.entryId + '.currentPhase invalid ' + entry.currentPhase);
});

const expectedMotion = ['idle','running','sprinting','slowed','blocked','pit_stop','takeover','finished','stale'];
const expectedMessageTypes = ['progress_update','milestone','strategy_change','quality_signal','risk_alert','obstacle','violation','takeover','pit_stop'];
const expectedAttentionCategories = ['risk','obstacle','violation'];
const presentMotion = new Set(entries.map((entry) => entry.motionState));
const presentMessageTypes = new Set(messages.map((message) => message.type));
const presentAttentionCategories = new Set(attentionItems.map((item) => item.category));
expectedMotion.forEach((state) => { if (!presentMotion.has(state)) warnings.push('motionState not covered: ' + state); });
expectedMessageTypes.forEach((type) => { if (!presentMessageTypes.has(type)) warnings.push('message type not covered: ' + type); });
expectedAttentionCategories.forEach((category) => { if (!presentAttentionCategories.has(category)) warnings.push('attention category not covered: ' + category); });

if (!messages.some((message) => message.displayMode === 'bubble')) errors.push('no bubble message');
if (!messages.some((message) => message.displayMode === 'ticker')) errors.push('no ticker message');
if (!entries.some((entry) => entry.motionState === 'stale')) warnings.push('no stale entry sample');

const serialized = JSON.stringify(race);
['/media/lemonhdl', '.claude', 'complete terminal log', 'complete Coding Agent Session', 'complex diff'].forEach((needle) => {
  if (serialized.includes(needle)) errors.push('private or forbidden content in race data: ' + needle);
});

const result = { status: errors.length ? 'fail' : 'pass', errors, warnings, counts: { entries: entries.length, messages: messages.length, attentionItems: attentionItems.length, lanes: (track.lanes || []).length } };
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
