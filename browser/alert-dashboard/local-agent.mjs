// Local, rule-based false-positive triage engine -- the "🔍 Lokaal
// onderzoeken" button's backend. No AI/API calls, no secrets, runs
// synchronously against whatever's already on this host (ss, the
// dashboard's own connection list, and the knowledge base in
// known-traffic.mjs). See docs/decisions/architecture_decisions.md,
// "False-Positive Triage Agent", for why this is local-only rather than
// a standalone AI service.
//
// This is deliberately a narrower, faster, always-available sibling to
// the periodic Claude Code check (which can reason about genuinely novel
// situations) -- this engine can only recognize patterns someone
// explicitly taught it (known-traffic.mjs) or that it has seen repeat
// often enough to flag as a suggested new pattern (see getSuggestedRules
// below). It will say "uncertain" far more often than the AI check does,
// on purpose -- a wrong "dismiss" here has no human or AI judgement
// behind it at all, so the bar for a local verdict is higher.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getActiveConnections } from './connections.mjs';
import { KNOWN_PROCESSES, BENIGN_SIGNATURE_PATTERNS, NEVER_AUTO_DISMISS_BUCKETS } from './known-traffic.mjs';

const STATS_PATH = fileURLToPath(new URL('./dismissal-stats.json', import.meta.url));
const SUGGEST_THRESHOLD = 3; // repeat correlations before flagging "consider a permanent rule"
const TIMING_WINDOW_MS = 15_000; // matches the ET TOR case's actual gap (~24s->tight enough, see below)

function loadStats() {
  try { return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8')); } catch { return {}; }
}
function saveStats(stats) {
  try { fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2)); } catch { /* non-fatal, learning is best-effort */ }
}

// Only correlation-based verdicts feed the learning loop -- signature
// knowledge-base matches are already permanent rules by definition
// (they're hardcoded in known-traffic.mjs), nothing to "learn" there.
function recordCorrelation(alert, reason, evidence) {
  const stats = loadStats();
  const key = `${evidence}:${alert.signature}`;
  const entry = stats[key] || { signature: alert.signature, evidence, count: 0, reasons: [] };
  entry.count++;
  entry.reasons.push({ reason, at: Date.now() });
  if (entry.reasons.length > 20) entry.reasons = entry.reasons.slice(-20);
  stats[key] = entry;
  saveStats(stats);
}

// Alerts repeatedly dismissed via the same correlation path -- worth
// Joost's attention as "maybe promote this to a real rule in
// known-traffic.mjs/categorize.mjs", surfaced explicitly rather than
// auto-escalated to silent-forever (see the architecture-decision doc's
// stated learning philosophy).
export function getSuggestedRules() {
  const stats = loadStats();
  return Object.values(stats)
    .filter((v) => v.count >= SUGGEST_THRESHOLD)
    .map((v) => ({
      signature: v.signature,
      evidence: v.evidence,
      count: v.count,
      lastReason: v.reasons[v.reasons.length - 1]?.reason,
    }));
}

/**
 * @param {object} alert - one alert record from server.mjs's `alerts` array
 * @param {object} ctx - { recentAlerts: array of other in-memory alerts }
 * @returns {Promise<{verdict: 'dismiss'|'uncertain'|'keep', reason: string, evidence?: string}>}
 */
export async function investigateAlert(alert, ctx = {}) {
  if (NEVER_AUTO_DISMISS_BUCKETS.has(alert.bucket)) {
    return { verdict: 'keep', reason: 'Categorie staat op de nooit-automatisch-wegstrepen-lijst -- alleen handmatige beoordeling.' };
  }

  // 1. Signature knowledge base -- narrow, explicit, permanent rules.
  for (const { pattern, reason } of BENIGN_SIGNATURE_PATTERNS) {
    if (pattern.test(alert.signature)) {
      return { verdict: 'dismiss', reason, evidence: 'signature-knowledge-base' };
    }
  }

  // 2. Process correlation -- alert's counterpart IP is currently a live
  //    peer of a known, expected local process. Accepts a pre-fetched
  //    connection list (ctx.connections) so a caller processing a whole
  //    batch of alerts -- e.g. server.mjs's automatic per-poll triage --
  //    only has to shell out to `ss` once, not once per alert.
  const connections = ctx.connections || await getActiveConnections().catch(() => []);
  for (const proc of KNOWN_PROCESSES) {
    const active = connections.filter((c) =>
      proc.processMatch.some((m) => (c.process || '').toLowerCase().includes(m)));
    if (!active.length) continue;
    const counterpart = active.find((c) => c.peerAddr === alert.srcIp || c.peerAddr === alert.dstIp);
    if (counterpart) {
      const reason = `Komt overeen met een actieve ${proc.name}-verbinding naar hetzelfde IP `
        + `(${counterpart.peerAddr}:${counterpart.peerPort}, ${counterpart.state || counterpart.proto}). ${proc.note}`;
      recordCorrelation(alert, reason, 'process-correlation');
      return { verdict: 'dismiss', reason, evidence: 'process-correlation' };
    }
  }

  // 3. Timing correlation -- generalizes the manual "ET TOR coincided with
  //    an active torrent burst" investigation (2026-07-21): an otherwise
  //    unexplained alert from the same host, seconds apart from a
  //    known-benign P2P alert, is very likely the same swarm's traffic
  //    incidentally tripping a second, unrelated signature.
  const recentAlerts = ctx.recentAlerts || [];
  const nearbyBenign = recentAlerts.find((a) =>
    a.id !== alert.id
    && a.bucket === 'P2P'
    && (a.srcIp === alert.srcIp || a.srcIp === alert.dstIp)
    && Math.abs(new Date(a.timestamp).getTime() - new Date(alert.timestamp).getTime()) < TIMING_WINDOW_MS);
  if (nearbyBenign) {
    const reason = `Valt binnen 15s samen met een P2P/Torrent-melding van dezelfde host (${alert.srcIp}) -- `
      + `waarschijnlijk een torrent-peer/DHT-node die toevallig ook deze regel triggert (zelfde patroon als de `
      + `ET TOR-melding, 2026-07-21).`;
    recordCorrelation(alert, reason, 'timing-correlation');
    return { verdict: 'dismiss', reason, evidence: 'timing-correlation' };
  }

  return { verdict: 'uncertain', reason: 'Geen bekend patroon of correlatie gevonden -- vereist handmatige of AI-beoordeling.' };
}
