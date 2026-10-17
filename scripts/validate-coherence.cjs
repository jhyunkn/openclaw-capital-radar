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
 *       sight — see components/radar/opportunities/render.cjs).
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
