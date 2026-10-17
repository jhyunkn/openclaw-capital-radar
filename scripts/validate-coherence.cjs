'use strict';

/*
 * Homepage coherence validator (Phase 0, 2026-10-17).
 *
 * Guards against the page quietly arguing with itself. Inspects the BUILT
 * homepage HTML (index.html, falling back to public/index.html) and fails
 * when:
 *   (a) the Market Cycle phase code and the Cycle Watch headline phase
 *       disagree (e.g. header "C" vs Cycle Watch "Late Phase D");
 *   (b) the next-phase odds line has duplicate phase labels across
 *       holds / advances / slips, or its percentages do not sum to 100;
 *   (c) 2+ anticipatory probes print identical calibrated-probability
 *       values while the Opportunity section carries no cohort labeling
 *       (cohort statistics must be labeled as cohort statistics, in plain
 *       sight — see components/radar/opportunities/render.cjs);
 *   (d) the Cycle Watch tape disagrees with the page's primary tape:
 *       Cycle Watch VIX vs the primary VIX print (tolerance ±0.5), and
 *       Cycle Watch S&P-vs-200D vs the momentum gate's SPX-vs-200D
 *       (tolerance ±0.3pp). Guards the 2026-10-16 failure where Cycle
 *       Watch's own history file carried an intraday bar stamped as a
 *       close (VIX 15.97 "calm" vs the 19.99 close);
 *   (e) more than one distinct current-CAPE value printed page-wide.
 *       CAPE has a single dated source (data/valuation-cape.json); every
 *       consumer — fans anchor, cycle evidence, analog text — must print
 *       the same number;
 *   (f) the Robinhood account strip's printed components do not sum to
 *       its printed Portfolio total (tolerance ±$1). Guards the 2026-10-16
 *       render where Portfolio $92,212 sat next to Equity $86,035 + Cash
 *       $4,766 = $90,801 because the $1,411 crypto component was never
 *       printed;
 *   (g) the S&P fan narrative carries a hand-typed S&P level. The fan's
 *       table and prose are rendered client-side, so computed endpoints
 *       do not exist in the built HTML to cross-check numerically; the
 *       structural guard is that the kp init script contains NO $X,XXX
 *       literal anywhere (narrative endpoints are interpolated from the
 *       computed paths via D2030(PATHS.*)) and the retired false anchor
 *       claim ("$338 × 22x = $7,436 · validates start") stays absent.
 *       Guards the 2026-10-17 audit finding of nine hand-written
 *       narrative endpoints contradicting the models' own computed ones.
 *
 * Read-only: it never edits artifacts. Exit 0 = coherent, 1 = violation.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const candidates = ['index.html', path.join('public', 'index.html')]
  .map(rel => path.join(root, rel))
  .filter(f => fs.existsSync(f));

if (!candidates.length) {
  console.error('FAIL coherence — no built homepage found (index.html / public/index.html). Run a build first.');
  process.exit(1);
}

const results = [];
function check(label, ok, evidence) {
  results.push({ label, ok, evidence });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} — ${evidence}`);
}

for (const file of candidates) {
  const rel = path.relative(root, file);
  const html = fs.readFileSync(file, 'utf8');

  // ── (a) Phase coherence: Market Cycle header vs Cycle Watch headline ──
  const cycleMatch = html.match(/mu-cycle-code">\s*([A-Z]\d?)/);
  const cwMatch = html.match(/mu-cw-read">([^<]*)/);
  if (cycleMatch && cwMatch) {
    const cycleCode = cycleMatch[1];
    const cwPhase = (cwMatch[1].match(/[Pp]hase\s+([A-Z]\d?)/) || [])[1] || null;
    if (cwPhase) {
      check(`${rel} · phase coherence`,
        cycleCode === cwPhase,
        `Market Cycle header = ${cycleCode}, Cycle Watch headline phase = ${cwPhase}` +
        (cycleCode === cwPhase ? '' : ' — the two sections derive their phase from different sources (egg state vs data/cycle-thesis.json editorial read) and currently disagree'));
    } else {
      console.log(`SKIP ${rel} · phase coherence — Cycle Watch read carries no phase token: "${cwMatch[1].slice(0, 60)}…"`);
    }
  } else {
    console.log(`SKIP ${rel} · phase coherence — ${!cycleMatch ? 'Market Cycle header' : 'Cycle Watch read'} not found`);
  }

  // ── (b) Next-phase odds: distinct labels, sums to 100 ──
  const odds = html.match(/Next-phase odds — holds ([A-Z]\d?) (\d+)% · advances to ([A-Z]\d?) (\d+)% · slips to ([A-Z]\d?) (\d+)% · other (\d+)%/);
  if (!odds) {
    check(`${rel} · next-phase odds`, false, 'odds line not found or malformed (expected "holds X n% · advances to Y n% · slips to Z n% · other n%")');
  } else {
    const [, holdCode, holdPct, advCode, advPct, slipCode, slipPct, otherPct] = odds;
    const codes = [holdCode, advCode, slipCode];
    const distinct = new Set(codes).size === codes.length;
    const sum = Number(holdPct) + Number(advPct) + Number(slipPct) + Number(otherPct);
    check(`${rel} · next-phase odds labels`, distinct,
      `holds ${holdCode} · advances to ${advCode} · slips to ${slipCode}` + (distinct ? '' : ' — duplicate phase label'));
    check(`${rel} · next-phase odds sum`, sum === 100,
      `${holdPct} + ${advPct} + ${slipPct} + ${otherPct} = ${sum}`);
  }

  // ── (d) Cross-tape: Cycle Watch vs the page's primary prints ──
  const cwVixM = html.match(/mu-cw-name">VIX<\/span>\s*<b class="mu-cw-now">([\d.]+)</);
  const primVixM = html.match(/<span>VIX<\/span><b>([\d.]+)<\/b>/);
  if (cwVixM && primVixM) {
    const cw = Number(cwVixM[1]), prim = Number(primVixM[1]);
    check(`${rel} · cross-tape VIX`, Math.abs(cw - prim) <= 0.5,
      `Cycle Watch VIX ${cw} vs primary tape ${prim} (tolerance ±0.5)`);
  } else {
    console.log(`SKIP ${rel} · cross-tape VIX — ${!cwVixM ? 'Cycle Watch VIX row' : 'primary VIX print'} not found`);
  }
  const cwDistM = html.match(/mu-cw-name">S&amp;P 500 vs 200-day<\/span>\s*<b class="mu-cw-now">([+-]?[\d.]+)%/);
  const primDistM = html.match(/SPX (?:above|below) 200D \(([+-]?[\d.]+)%\)/);
  if (cwDistM && primDistM) {
    const cw = Number(cwDistM[1]), prim = Number(primDistM[1]);
    check(`${rel} · cross-tape SPX vs 200D`, Math.abs(cw - prim) <= 0.3,
      `Cycle Watch ${cw}% vs momentum gate ${prim}% (tolerance ±0.3pp)`);
  } else {
    console.log(`SKIP ${rel} · cross-tape SPX vs 200D — ${!cwDistM ? 'Cycle Watch 200D row' : 'momentum gate print'} not found`);
  }

  // ── (e) CAPE: one current value page-wide ──
  const capePatterns = [
    /CAPE\s+(?:<b>)?(\d+\.\d+)×/g,            // "CAPE 40.54×" (fans, evidence, cards)
    /(\d+\.\d+)×\s*CAPE/g,                    // "40.54× CAPE" (exceptions text)
    /CAPE[\s\S]{0,60}?vs\s+(\d+\.\d+)×?\s+now/g, // "CAPE ~44 then vs 40.54 now" (analogs)
    /Current\s+(\d+\.\d+)×/g,                 // "Current 40.54×" (history series desc)
    /CAPE (?:reverting|reversion)\s+(\d+\.\d+)x/g, // fan info text (ASCII x)
    /'(\d+\.\d+)×',\s*lbl:'Shiller CAPE'/g,   // history stat card
    /NOW_CAPE=(\d+\.\d+)/g,                   // fans anchor constant in the init script
  ];
  const capeValues = new Set();
  for (const re of capePatterns) {
    for (const m of html.matchAll(re)) capeValues.add(m[1]);
  }
  if (capeValues.size) {
    check(`${rel} · CAPE single value`, capeValues.size === 1,
      `current-CAPE prints page-wide: [${[...capeValues].join(', ')}]` +
      (capeValues.size === 1 ? '' : ' — more than one distinct value; all consumers must read data/valuation-cape.json'));
  } else {
    console.log(`SKIP ${rel} · CAPE single value — no current-CAPE print matched`);
  }

  // ── (f) Account strip: printed components must sum to printed total ──
  const statRe = /rh-stat"><b>\$([\d,]+)<\/b><small>(Portfolio|Equity|Crypto|Cash)<\/small>/g;
  const stats = {};
  for (const m of html.matchAll(statRe)) stats[m[2]] = Number(m[1].replace(/,/g, ''));
  if (stats.Portfolio != null) {
    const parts = ['Equity', 'Crypto', 'Cash'];
    const missing = parts.filter(k => stats[k] == null);
    if (missing.length) {
      check(`${rel} · account reconciliation`, false,
        `Portfolio $${stats.Portfolio.toLocaleString('en-US')} printed without component(s): ${missing.join(', ')} — components must be printed and sum to the total`);
    } else {
      const sum = parts.reduce((s, k) => s + stats[k], 0);
      check(`${rel} · account reconciliation`, Math.abs(stats.Portfolio - sum) <= 1,
        `Portfolio $${stats.Portfolio.toLocaleString('en-US')} vs Equity $${stats.Equity.toLocaleString('en-US')} + Crypto $${stats.Crypto.toLocaleString('en-US')} + Cash $${stats.Cash.toLocaleString('en-US')} = $${sum.toLocaleString('en-US')} (tolerance ±$1)`);
    }
  } else {
    console.log(`SKIP ${rel} · account reconciliation — Robinhood sync strip not found`);
  }

  // ── (g) Fan narrative: endpoints generated, never hand-typed ──
  const kpM = html.match(/<script id="kp-init-script">([\s\S]*?)<\/script>/);
  if (kpM) {
    const kp = kpM[1];
    const typed = [...new Set([...kp.matchAll(/\$\d{1,3}(?:,\d{3})+/g)].map(x => x[0]))];
    const generated = (kp.match(/D2030\(PATHS\./g) || []).length;
    const falseAnchor = /validates start/i.test(kp);
    check(`${rel} · fan narrative generated`, typed.length === 0 && !falseAnchor,
      (typed.length
        ? `hand-typed S&P level(s) in fan script: ${typed.join(', ')} — narrative endpoints must be interpolated from the computed paths`
        : 'no hand-typed $X,XXX levels in the fan script') +
      `; D2030(PATHS.*) interpolations: ${generated}` +
      (falseAnchor ? '; FALSE anchor claim "validates start" present' : ''));
  } else {
    console.log(`SKIP ${rel} · fan narrative generated — kp-init-script not found`);
  }

  // ── (c) Probe statistics: identical probabilities need cohort labeling ──
  const oppStart = html.indexOf('opportunities-section');
  const opp = oppStart >= 0 ? html.slice(oppStart) : '';
  const probs = [...opp.matchAll(/([\d.]+)% calibrated/g)].map(m => m[1]);
  const dupProbs = probs.filter((v, i) => probs.indexOf(v) !== i);
  if (probs.length >= 2 && dupProbs.length) {
    const labeled = /cohort statistics/i.test(opp);
    check(`${rel} · probe cohort labeling`, labeled,
      `calibrated probabilities [${probs.join(', ')}] include duplicates across probes` +
      (labeled ? ' — cohort statistics are labeled in plain sight' : ' — identical per-probe probabilities with NO cohort labeling in the Opportunity section'));
  } else {
    console.log(`SKIP ${rel} · probe cohort labeling — calibrated probabilities [${probs.join(', ')}] (no duplicate-probability condition)`);
  }
}

const failed = results.filter(r => !r.ok);
console.log(`\nCoherence validation: ${results.length - failed.length}/${results.length} checks passed across ${candidates.length} file(s).`);
if (failed.length) {
  console.error(`COHERENCE VALIDATION FAILED: ${failed.map(f => f.label).join('; ')}`);
  process.exit(1);
}
console.log('Coherence validation PASSED.');
