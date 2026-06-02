'use strict';
// Source Confidence Standard Review
// Determines whether Capital Radar should remain in research-only posture or can
// upgrade to stronger decision-support language, based on the strict gate criteria.
const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out  = path.join(root, 'outputs', 'source-confidence-review.json');

function readJson(rel, fb = null) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return fb;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; }
}

// ── Strict gate: scan all critical state files for banned language ────────────
const BANNED_PATTERNS = [
  // "sample" in the context of placeholder/mock data — not "sample size" or "sample rate"
  { pattern: /\bsample\s+state\b|\bsample\s+only\b|\bSample:/,              label: 'sample_state' },
  { pattern: /\bverify\s+live\b(?!\s+tape)/i,                               label: 'verify_live_placeholder' },
  { pattern: /\bpending\s+filings/i,                                         label: 'pending_filings' },
  { pattern: /\breplace\s+sample\b/i,                                        label: 'replace_sample' },
  { pattern: /\bplaceholder\b/i,                                             label: 'placeholder' },
  { pattern: /\btodo\b/i,                                                    label: 'todo' },
];

const FILES_TO_SCAN = [
  'data/report-state.live.json',
  'outputs/data-truth-state.json',
  'outputs/authoritative-action-state.json',
  'outputs/live-reaction-state.json',
  'outputs/opportunity-asymmetry-state.json',
  'outputs/portfolio-translation-state.json',
];

// Walk JSON and find all string values matching a pattern
function scanJson(obj, patterns, path = '') {
  const hits = [];
  if (typeof obj === 'string') {
    for (const { pattern, label } of patterns) {
      if (pattern.test(obj)) {
        hits.push({ path, label, excerpt: obj.slice(0, 120) });
        break; // one hit per path
      }
    }
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) hits.push(...scanJson(obj[i], patterns, `${path}[${i}]`));
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) hits.push(...scanJson(v, patterns, `${path}.${k}`));
  }
  return hits;
}

// ── Source coverage checks ────────────────────────────────────────────────────
const news   = readJson('outputs/news-catalyst-state.json');
const xbrl   = readJson('outputs/sec-xbrl-fundamentals.json');
const action = readJson('outputs/authoritative-action-state.json', { actionStates: [] });
const ledger = readJson('outputs/source-reliability-ledger.json', { sources: [] });

function ageHours(ts) {
  const t = Date.parse(ts || '');
  return Number.isFinite(t) ? (Date.now() - t) / 36e5 : null;
}

// ── Gate checks ───────────────────────────────────────────────────────────────
const gates = {};

// Gate 1: News collector wired and fresh
gates.news_wired = news != null;
gates.news_fresh = news ? (ageHours(news.scanned_at) || Infinity) < 6 : false;
gates.news_has_high_materiality = news ? (news.summary?.high_materiality ?? 0) > 0 : false;

// Gate 2: XBRL fundamentals collected
gates.xbrl_collected = xbrl != null;
gates.xbrl_ok_coverage = xbrl ? (xbrl.summary?.ok ?? 0) >= 5 : false;

// Gate 3: Strict language gate — count banned markers across state files
let totalBannedMarkers = 0;
const bannedByFile = {};
for (const rel of FILES_TO_SCAN) {
  const data = readJson(rel);
  if (!data) { bannedByFile[rel] = { status: 'file_missing', hits: [] }; continue; }
  const hits = scanJson(data, BANNED_PATTERNS);
  bannedByFile[rel] = { status: 'scanned', hits_count: hits.length, hits: hits.slice(0, 20) };
  totalBannedMarkers += hits.length;
}
gates.strict_gate_clear = totalBannedMarkers === 0;
gates.banned_marker_count = totalBannedMarkers;

// Gate 4: Authoritative action state has numeric levels
const actionStates = action.actionStates || [];
const actionsWithLevels = actionStates.filter(r => {
  const add = r.levels?.addZone || {};
  return Number.isFinite(Number(add.low)) && Number.isFinite(Number(add.high));
});
gates.numeric_levels_coverage_pct = actionStates.length > 0
  ? Math.round((actionsWithLevels.length / actionStates.length) * 100)
  : 0;
gates.numeric_levels_complete = gates.numeric_levels_coverage_pct >= 80;

// Gate 5: Source ledger has primary evidence sources
const primarySources = (ledger.sources || []).filter(s => s.reliabilityClass === 'primary-evidence');
gates.primary_sources_count = primarySources.length;
gates.has_primary_evidence_sources = primarySources.length >= 2;

// ── Decision: research-only or decision-support ───────────────────────────────
const gatesPass = gates.news_wired && gates.news_fresh && gates.xbrl_collected &&
                  gates.strict_gate_clear && gates.has_primary_evidence_sources;

const recommendation = gatesPass
  ? 'READY_FOR_DECISION_SUPPORT'
  : 'REMAIN_RESEARCH_ONLY';

const blockers = [];
if (!gates.news_wired)              blockers.push('News collector not run — execute: npm run collect:news');
if (!gates.news_fresh)              blockers.push('News data stale (>6h) — re-run: npm run collect:news');
if (!gates.xbrl_collected)          blockers.push('XBRL fundamentals not collected — execute: npm run collect:xbrl');
if (!gates.xbrl_ok_coverage)       blockers.push('XBRL coverage thin (<5 tickers ok)');
if (!gates.strict_gate_clear)      blockers.push(`Strict language gate: ${totalBannedMarkers} banned markers remain across state files`);
if (!gates.numeric_levels_complete) blockers.push(`Numeric price levels incomplete (${gates.numeric_levels_coverage_pct}% of holdings have add/trim zones)`);
if (!gates.has_primary_evidence_sources) blockers.push('Fewer than 2 primary-evidence sources in reliability ledger');

// ── Decision-support upgrade criteria (for reference) ────────────────────────
const upgradeConditions = [
  { condition: 'News collector is wired and fresh (<6h)',              met: gates.news_wired && gates.news_fresh },
  { condition: 'XBRL fundamentals collected for ≥5 equity tickers',   met: gates.xbrl_ok_coverage },
  { condition: 'Strict gate: zero banned language markers',            met: gates.strict_gate_clear },
  { condition: 'Numeric price levels ≥80% of holdings',               met: gates.numeric_levels_complete },
  { condition: '≥2 primary-evidence sources in reliability ledger',   met: gates.has_primary_evidence_sources },
];

const state = {
  artifact: 'source-confidence-review',
  generated_at: new Date().toISOString(),
  recommendation,
  decision_label: gatesPass
    ? 'Capital Radar may upgrade from research-only to decision-support language.'
    : 'Capital Radar must remain in research-only posture until all gate conditions are met.',
  gates,
  blockers,
  upgrade_conditions: upgradeConditions,
  strict_gate: {
    total_banned_markers: totalBannedMarkers,
    files_scanned: FILES_TO_SCAN.length,
    detail: bannedByFile
  },
  source_confidence_standard: {
    research_only_posture: 'Default until: (1) news is live, (2) XBRL fundamentals collected, (3) strict language gate clear, (4) numeric price levels filled.',
    decision_support_posture: 'Permitted when all upgrade conditions above are met simultaneously.',
    capital_action_posture: 'Requires decision-support posture PLUS: defined risk budget per position, primary-source evidence for each candidate, explicit invalidation levels.',
    language_rules: {
      research_only: [
        'Use: "research-only", "observe", "watch", "verify before acting".',
        'Forbidden: "buy now", "recommended action", "entry signal confirmed", "strong conviction add".',
      ],
      decision_support: [
        'Permitted: "evidence supports add-review near [zone]", "invalidation at [level]", "thesis gate cleared".',
        'Still forbidden: "buy now", "guaranteed", "certain outcome".',
      ]
    }
  }
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n');

console.log(`source-confidence-review: ${recommendation}`);
console.log(`  banned_markers=${totalBannedMarkers} | news=${gates.news_wired ? 'wired' : 'MISSING'} | xbrl=${gates.xbrl_collected ? 'ok' : 'MISSING'}`);
if (blockers.length) {
  console.log('  blockers:');
  for (const b of blockers) console.log(`    - ${b}`);
}
console.log(`wrote ${path.relative(root, out)}`);
