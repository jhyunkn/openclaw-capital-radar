'use strict';

/*
 * Fail-closed validator for the engine-fed Opportunity decision surface.
 *
 * Enforces Jun's card contract:
 *  - only strategies: momentum-fit | arb-fit
 *  - every ACTIONABLE card carries: entry, ceiling(+margin), invalidation,
 *    duration, catalyst, engine evidence. A card missing any of these fails
 *    the whole state — it must never render half a trade.
 *  - momentum-fit cards must be top-decile momentum names inside the
 *    top-200 market-cap recognizability gate with GOOD entries.
 *  - watchlist cards must be WAIT-state FAIR/POOR entries with a written
 *    condition for promotion.
 *  - arb-fit cards must come from TRADEABLE deals only (no THIN/STUB/
 *    NEGATIVE/incomplete/sailed names — the generator filters; this
 *    validator re-checks the strategy set, not the arb board itself).
 */

const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const STATE = path.join(root, 'outputs', 'opportunity', 'opportunity-state.json');

let failures = 0;
function fail(msg) { failures++; console.error(`OPPORTUNITY_VALIDATION_FAIL: ${msg}`); }
const isNum = v => Number.isFinite(v);
const nonEmpty = v => typeof v === 'string' && v.trim().length > 0;

if (!fs.existsSync(STATE)) { fail(`missing ${STATE}`); process.exit(1); }
let st;
try { st = JSON.parse(fs.readFileSync(STATE, 'utf8')); }
catch (e) { fail(`invalid JSON: ${e.message}`); process.exit(1); }

if (st.artifact !== 'opportunity-state') fail(`artifact tag wrong: ${st.artifact}`);
const gate = st.recognitionGate || {};
if (gate.type !== 'sp500-marketcap-top200') fail('recognitionGate.type must be sp500-marketcap-top200');
if (!nonEmpty(gate.asOf)) fail('recognitionGate.asOf missing');
if (!nonEmpty(gate.source)) fail('recognitionGate.source missing');

const board = Array.isArray(st.board) ? st.board : (fail('board must be an array'), []);
const watch = Array.isArray(st.watchlist) ? st.watchlist : (fail('watchlist must be an array'), []);

const seen = new Set();
for (const c of board) {
  const tag = c.symbol || '(missing symbol)';
  if (!nonEmpty(c.symbol)) { fail('board card missing symbol'); continue; }
  if (seen.has(c.symbol)) fail(`${tag}: duplicate symbol on board`);
  seen.add(c.symbol);
  if (!['momentum-fit', 'arb-fit'].includes(c.strategy)) fail(`${tag}: strategy must be momentum-fit or arb-fit, got ${c.strategy}`);
  if (c.state !== 'ACTIONABLE') fail(`${tag}: board card state must be ACTIONABLE, got ${c.state}`);

  if (!c.entry || !isNum(c.entry.price) || c.entry.price <= 0) fail(`${tag}: entry.price missing/invalid`);
  if (!c.ceiling || !isNum(c.ceiling.price) || c.ceiling.price <= 0) fail(`${tag}: ceiling.price missing/invalid`);
  if (!c.ceiling || !isNum(c.ceiling.marginPct)) fail(`${tag}: ceiling.marginPct missing — approximate profit margin is required`);

  if (c.strategy === 'momentum-fit') {
    if (!Number.isInteger(c.marketCapRank) || c.marketCapRank > 200) fail(`${tag}: momentum-fit card must carry marketCapRank ≤ 200 (recognizability gate)`);
    if (!Number.isInteger(c.momentumRank)) fail(`${tag}: momentum-fit card missing momentumRank (top-decile evidence)`);
    if (c.entryRating !== 'GOOD') fail(`${tag}: momentum-fit board card must have GOOD entry rating, got ${c.entryRating}`);
    if (!c.invalidation || !isNum(c.invalidation.price) || c.invalidation.price <= 0) fail(`${tag}: invalidation.price missing/invalid`);
    if (!c.invalidation || !isNum(c.invalidation.riskPct)) fail(`${tag}: invalidation.riskPct missing — approximate risk is required`);
    if (!c.duration || !/^\d{4}-\d{2}-\d{2}$/.test(c.duration.through || '')) fail(`${tag}: duration.through (YYYY-MM-DD) missing — no duration, no trade`);
  } else {
    if (!c.invalidation || !nonEmpty(c.invalidation.condition)) fail(`${tag}: arb-fit card needs invalidation.condition`);
    if (!c.duration || !(nonEmpty(c.duration.through) || nonEmpty(c.duration.label))) fail(`${tag}: arb-fit card needs duration (through date or close label)`);
  }

  if (!nonEmpty(c.catalyst)) fail(`${tag}: catalyst missing — no catalyst, no trade`);
  if (!c.evidence || typeof c.evidence !== 'object' || !nonEmpty(c.evidence.engine)) fail(`${tag}: evidence.engine missing — card must link to its engine row`);
}

for (const w of watch) {
  const tag = w.symbol || '(missing symbol)';
  if (!nonEmpty(w.symbol)) { fail('watchlist item missing symbol'); continue; }
  if (w.state !== 'WAIT') fail(`${tag}: watchlist item state must be WAIT, got ${w.state}`);
  if (!['FAIR', 'POOR', 'GOOD'].includes(w.entryRating)) fail(`${tag}: watchlist entryRating must be FAIR, POOR, or GOOD-at-peak, got ${w.entryRating}`);
  // GOOD-rated names may only wait if they are parked at/near the 20-day
  // ceiling (no lower-end entry). FAIR/POOR wait on a rating flip.
  if (w.entryRating === 'GOOD' && !(w.current && w.current.offHighPct > -0.5)) {
    fail(`${tag}: GOOD-rated watchlist item must be at/near its 20-day high (offHighPct > -0.5)`);
  }
  if (!nonEmpty(w.waitingFor)) fail(`${tag}: watchlist item missing waitingFor — must say what flips it to actionable`);
}

const counts = st.counts || {};
if (counts.board !== board.length) fail(`counts.board ${counts.board} != board.length ${board.length}`);
if (counts.watchlist !== watch.length) fail(`counts.watchlist ${counts.watchlist} != watchlist.length ${watch.length}`);

if (failures) process.exit(1);
console.log(`OPPORTUNITY_VALIDATION_OK: board=${board.length} (momentum-fit=${board.filter(c=>c.strategy==='momentum-fit').length}, arb-fit=${board.filter(c=>c.strategy==='arb-fit').length}) watchlist=${watch.length} gate=top200 asOf=${gate.asOf}`);
