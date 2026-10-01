'use strict';
/*
 * validate-arb-deal-board.cjs — asserts the arb deal board is schema-correct
 * and that its spread math is honestly recomputed, not invented.
 *
 * Fails (exit non-zero) on:
 *  - unparseable JSON / missing required fields
 *  - considerationType or confidence outside their enums
 *  - expectedCloseDate unparseable and non-null
 *  - spread/annualized math that does not recompute within 0.1%
 *  - capacity table rows that do not recompute from spreadPct
 *  - verdict inconsistent with the board's own rules
 *  - generatedAt older than 36h (stale presented as fresh)
 *  - any price without a priceAsOf (invented prices)
 *  - deals not sorted by annualizedSpreadPct desc (nulls last)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const boardPath = path.join(root, 'outputs', 'arb', 'arb-deal-board.json');

function stop(message) { console.error(`ARB DEAL BOARD CHECK FAILED: ${message}`); process.exit(1); }
function ok(cond, message) { if (!cond) stop(message); }

ok(fs.existsSync(boardPath), 'outputs/arb/arb-deal-board.json missing');
let board;
try { board = JSON.parse(fs.readFileSync(boardPath, 'utf8')); } catch (e) { stop(`JSON parse failed: ${e.message}`); }

ok(board.generatedAt, 'generatedAt missing');
const ageH = (Date.now() - new Date(board.generatedAt).getTime()) / 3600000;
ok(isFinite(ageH) && ageH >= 0, 'generatedAt not a valid date');
ok(ageH <= 36, `generatedAt ${ageH.toFixed(1)}h old — stale board, regenerate`);
ok(Array.isArray(board.deals), 'deals missing');
ok(Array.isArray(board.watchlist), 'watchlist missing');
ok(board.dataHealth && typeof board.dataHealth.status === 'string', 'dataHealth missing');

const CONSIDERATION = new Set(['cash', 'stock', 'collar', 'mixed']);
const CONFIDENCE = new Set(['HIGH', 'MEDIUM', 'LOW', 'MANUAL']);
const VERDICTS = [/^TRADEABLE — /, /^THIN — no romance$/, /^NEGATIVE — target above offer$/, /^NO TIMELINE — cannot annualize$/, /^NOT TRADEABLE$/, /^NO EDGE — merger of equals$/];

for (const w of board.watchlist) {
  ok(CONFIDENCE.has(w.confidence), `watchlist ${w.target}: bad confidence ${w.confidence}`);
  ok(w.confidence === 'LOW', `watchlist ${w.target}: only LOW-confidence items belong on the watchlist`);
}

let prevAnn = Infinity;
for (const d of board.deals) {
  const id = d.targetSymbol || d.target || '?';
  ok(d.target, `${id}: target missing`);
  ok(CONFIDENCE.has(d.confidence), `${id}: bad confidence ${d.confidence}`);
  ok(d.considerationType == null || CONSIDERATION.has(d.considerationType), `${id}: bad considerationType ${d.considerationType}`);
  ok(d.expectedCloseDate == null || /^\d{4}-\d{2}-\d{2}$/.test(d.expectedCloseDate), `${id}: expectedCloseDate not YYYY-MM-DD or null`);
  ok(typeof d.tradeable === 'boolean', `${id}: tradeable missing`);
  ok(VERDICTS.some(v => v.test(String(d.verdict))), `${id}: verdict '${d.verdict}' outside allowed set`);
  if (!d.tradeable) ok(d.tradeableReason, `${id}: not tradeable but no reason given`);

  // no invented prices: every price carries a priceAsOf
  if (d.targetPrice != null) ok(d.targetPriceAsOf, `${id}: targetPrice without priceAsOf`);
  if (d.acquirerPrice != null) ok(d.acquirerPriceAsOf, `${id}: acquirerPrice without priceAsOf`);
  ok(d.targetPrice == null || d.targetPrice > 0, `${id}: non-positive targetPrice`);
  ok(d.acquirerPrice == null || d.acquirerPrice > 0, `${id}: non-positive acquirerPrice`);

  // recompute spread math within 0.1%
  if (d.tradeable && d.spreadPct != null) {
    let expected = null;
    if (d.considerationType === 'cash' && d.offerPricePerShare) expected = d.offerPricePerShare / d.targetPrice - 1;
    else if ((d.considerationType === 'stock' || d.considerationType === 'collar') && d.exchangeRatio && d.acquirerPrice) {
      expected = (d.exchangeRatio * d.acquirerPrice) / d.targetPrice - 1;
      ok(d.shortRequired === true, `${id}: stock deal must flag shortRequired`);
      ok(d.borrowData === 'unavailable', `${id}: stock deal must flag borrowData unavailable`);
    }
    else if (d.considerationType === 'mixed' && d.offerPricePerShare) {
      if (d.exchangeRatio && d.acquirerPrice) {
        expected = (d.offerPricePerShare + d.exchangeRatio * d.acquirerPrice) / d.targetPrice - 1;
        ok(d.shortRequired === true, `${id}: mixed deal with stock leg must flag shortRequired`);
        ok(d.borrowData === 'unavailable', `${id}: mixed deal with stock leg must flag borrowData unavailable`);
      } else {
        expected = d.offerPricePerShare / d.targetPrice - 1;
      }
    }
    if (expected != null) {
      ok(Math.abs(expected - d.spreadPct) <= 0.001, `${id}: spreadPct ${d.spreadPct} != recomputed ${expected.toFixed(4)}`);
    }
    // annualized recompute
    if (d.annualizedSpreadPct != null && d.tradingDaysToClose > 0) {
      const ann = Math.pow(1 + d.spreadPct, 252 / d.tradingDaysToClose) - 1;
      ok(Math.abs(ann - d.annualizedSpreadPct) <= 0.001, `${id}: annualizedSpreadPct mismatch`);
    }
    // capacity table recompute
    ok(Array.isArray(d.capacityTable) && d.capacityTable.length === 3, `${id}: capacityTable must have 3 rows`);
    for (const row of d.capacityTable) {
      ok([10000, 25000, 50000].includes(row.notional), `${id}: unexpected notional ${row.notional}`);
      ok(row.commissionUSD === 0, `${id}: commissions must be $0`);
      const eg = Math.round(row.notional * d.spreadPct * 100) / 100;
      ok(Math.abs((row.expectedGross ?? 0) - eg) <= 1, `${id}: capacityTable expectedGross mismatch at $${row.notional}`);
    }
    // verdict honesty rules
    if (d.annualizedSpreadPct != null && d.annualizedSpreadPct < 0.08 && d.spreadPct >= 0) {
      ok(/^THIN — no romance$/.test(d.verdict), `${id}: annualized ${(d.annualizedSpreadPct * 100).toFixed(1)}% must carry THIN verdict`);
    }
    if (d.spreadPct < 0) ok(/^NEGATIVE/.test(d.verdict), `${id}: negative spread must carry NEGATIVE verdict`);
  } else {
    ok(d.annualizedSpreadPct == null, `${id}: non-tradeable deal must not carry an annualized spread`);
  }

  // sort order: annualizedSpreadPct desc, nulls last
  const cur = d.annualizedSpreadPct == null ? -Infinity : d.annualizedSpreadPct;
  ok(cur <= prevAnn + 1e-9, `${id}: deals not sorted by annualizedSpreadPct desc`);
  prevAnn = cur;
}

// verdictCriteria auditability block: the verdict rules must travel with the data
ok(board.verdictCriteria && typeof board.verdictCriteria === 'object', 'verdictCriteria block missing');
ok(board.verdictCriteria.thinThreshold === 0.08, `verdictCriteria.thinThreshold is ${board.verdictCriteria.thinThreshold}, expected 0.08 (the value the verdict ladder enforces)`);
ok(Array.isArray(board.verdictCriteria.verdictLadder) && board.verdictCriteria.verdictLadder.length >= 6, 'verdictCriteria.verdictLadder incomplete');
ok(typeof board.verdictCriteria.displayRule === 'string' && board.verdictCriteria.displayRule.length > 0, 'verdictCriteria.displayRule missing');

// single source of truth: the renderer must count and card by VERDICT,
// never by the loose `tradeable` pre-filter boolean. Render the section and
// assert the displayed headline and cards match the verdict count exactly.
const { renderArbDealBoardSection } = require('../components/radar/arb/render.cjs');
const sectionHtml = renderArbDealBoardSection(board, { module: true });
const verdictTradeableCount = board.deals.filter(d => String(d.verdict || '').startsWith('TRADEABLE')).length;
const summaryMatch = sectionHtml.match(/arb-summary[^>]*>\s*(\d+) mined deal\(s\) · (\d+) tradeable/);
ok(summaryMatch, 'renderer summary line not found in rendered section');
ok(parseInt(summaryMatch[1], 10) === board.deals.length, `renderer summary deals ${summaryMatch[1]} != board deals ${board.deals.length}`);
ok(parseInt(summaryMatch[2], 10) === verdictTradeableCount, `renderer tradeable count ${summaryMatch[2]} != verdict TRADEABLE count ${verdictTradeableCount}`);
const cardCount = (sectionHtml.match(/<article class="arb-deal-card">/g) || []).length;
ok(cardCount === Math.min(verdictTradeableCount, 5), `renderer cards ${cardCount} != expected ${Math.min(verdictTradeableCount, 5)} (verdict TRADEABLE count, max 5)`);
const cardVerdicts = [...sectionHtml.matchAll(/<div class="arb-verdict[^"]*">([^<]*)<\/div>/g)].map(m => m[1]);
ok(cardVerdicts.length === cardCount, 'rendered card verdict count mismatch');
for (const v of cardVerdicts) ok(v.startsWith('TRADEABLE'), `rendered card carries non-TRADEABLE verdict: ${v}`);

const tradeable = verdictTradeableCount;
console.log(`arb deal board validated: ${board.deals.length} deals (${tradeable} TRADEABLE by verdict), ${board.watchlist.length} watchlist, generated ${ageH.toFixed(1)}h ago, health=${board.dataHealth.status}`);
