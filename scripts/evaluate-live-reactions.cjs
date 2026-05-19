const fs = require('fs');
const path = require('path');
const { numericLevels, strategyFor } = require('./capital-radar-strategy-rules.cjs');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'data', 'report-state.live.json');
const outPath = path.join(root, 'outputs', 'live-reaction-state.json');
const publicOutPath = path.join(root, 'public', 'outputs', 'live-reaction-state.json');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const tapeBySymbol = Object.fromEntries((state.liveMarket || []).map(x => [x.symbol, x]));
const STALE_BLOCK_MINUTES = 1440;
const CAUTION_MINUTES = 6 * 60;

function round(n, d = 2) { return typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(d)) : null; }
function minutesOld(iso) { return iso ? round((Date.now() - new Date(iso).getTime()) / 60000, 1) : null; }
function freshness(asOf) {
  const m = minutesOld(asOf);
  if (m == null) return { status: 'unknown', minutesOld: null, actionAllowed: false, note: 'No quote timestamp.' };
  if (m <= CAUTION_MINUTES) return { status: 'fresh_cycle', minutesOld: m, actionAllowed: true, note: 'Within current refresh cycle.' };
  if (m <= STALE_BLOCK_MINUTES) return { status: 'cycle_caution', minutesOld: m, actionAllowed: true, note: 'Older than intraday comfort window; verify before fast action, but do not block daily-cycle analysis.' };
  return { status: 'stale_blocked', minutesOld: m, actionAllowed: false, note: 'Older than 24h daily-refresh cadence; block action until generate:live refreshes.' };
}
function classify(ticker, price, levels, signal, fresh) {
  const t = String(ticker || '').toUpperCase();
  if (!fresh.actionAllowed) return { state: 'DATA_BLOCKED', permission: 'NO ACTION', priority: 1, read: 'Quote is older than the daily refresh cadence or missing. Refresh before reaction.' };
  if (levels.hardExit != null && price <= levels.hardExit) return { state: 'HARD_EXIT_REVIEW', permission: 'NO ADD / REVIEW EXIT', priority: 1, read: `At/below hard-exit review ${levels.hardExit}. Do not treat as bargain.` };
  if (levels.stop != null && price <= levels.stop) return { state: 'STOP_REVIEW', permission: 'NO ADD / THESIS RECHECK', priority: 1, read: `At/below stop-review ${levels.stop}. Require reclaim/confirmation before capital.` };
  if (levels.entryLow != null && price < levels.entryLow) return { state: 'BELOW_ENTRY_NOT_CONFIRMED', permission: 'WAIT FOR RECLAIM', priority: 2, read: `Below entry zone ${levels.entryLow}-${levels.entryHigh}; wait for reclaim unless capitulation-bounce rule is explicitly chosen.` };
  if (levels.entryLow != null && levels.entryHigh != null && price >= levels.entryLow && price <= levels.entryHigh) {
    const blocked = /EXIT|INVESTIGATE|TRIM/.test(signal || '');
    return { state: blocked ? 'IN_ZONE_BUT_SIGNAL_BLOCKED' : 'ENTRY_ZONE_REVIEW', permission: blocked ? 'NO ADD UNTIL BLOCK CLEARS' : 'ADD REVIEW ONLY', priority: blocked ? 1 : 2, read: `Inside entry zone ${levels.entryLow}-${levels.entryHigh}, but action still needs signal/thesis/risk confirmation.` };
  }
  if (levels.trimLow != null && price >= levels.trimLow) return { state: 'TRIM_PROTECT_REVIEW', permission: 'TRIM / PROTECT REVIEW', priority: 2, read: `At/above trim-protect zone ${levels.trimLow}-${levels.trimHigh}. Protect gains/risk budget.` };
  if (/EXIT/.test(signal || '')) return { state: 'EXIT_SIGNAL_ACTIVE', permission: 'NO ADD / REVIEW EXIT', priority: 1, read: 'Exit review signal overrides price proximity.' };
  if (/INVESTIGATE/.test(signal || '')) return { state: 'THESIS_VERIFICATION_REQUIRED', permission: 'NO ADD', priority: 2, read: 'Thesis/liquidity/downside proof required before capital.' };
  if (/TRIM/.test(signal || '')) return { state: 'TRIM_WATCH_ACTIVE', permission: 'NO ADD / WATCH RISK', priority: 2, read: 'Risk product or stretched setup; no new capital without fresh thesis.' };
  return { state: 'HOLD_TRACK', permission: 'HOLD / TRACK', priority: 3, read: 'No immediate reaction trigger; keep tracking.' };
}
function contextFor(ticker) {
  if (ticker === 'CONL') {
    const coin = tapeBySymbol.COIN;
    const btc = tapeBySymbol['BTC-USD'];
    return { requiredConfirmation: ['COIN stabilizes/reclaims intraday level', 'BTC risk tone not breaking down', 'CONL reclaims stop/entry level with volume'], context: `COIN ${coin?.price ?? 'n/a'} (${coin?.changePct ?? 'n/a'}%), BTC ${btc?.price ?? 'n/a'} (${btc?.changePct ?? 'n/a'}%).` };
  }
  if (ticker === 'TSLT') {
    const tsla = tapeBySymbol.TSLA;
    return { requiredConfirmation: ['TSLA confirms support/reversal', 'levered decay risk budget remains small'], context: `TSLA ${tsla?.price ?? 'n/a'} (${tsla?.changePct ?? 'n/a'}%).` };
  }
  return { requiredConfirmation: ['price zone', 'thesis confirmation', 'portfolio fit'], context: null };
}

const reactions = holdings.map(h => {
  const ticker = String(h.ticker || '').toUpperCase();
  const price = Number(h.livePrice);
  const levels = numericLevels(ticker, price, h.finviz?.parsed || {});
  const fresh = freshness(h.priceAsOf);
  const signal = h.computedSignal || h.signal;
  const status = classify(ticker, price, levels, signal, fresh);
  const ctx = contextFor(ticker);
  return { ticker, price, asOf: h.priceAsOf, freshness: fresh, signal, computedSignal: h.computedSignal, levels, reaction: status, strategy: strategyFor(ticker), confirmation: ctx.requiredConfirmation, context: ctx.context, weightPct: h.portfolioWeightPct, healthScore: h.healthScore, source: h.liveDataSource };
}).sort((a, b) => a.reaction.priority - b.reaction.priority || (a.freshness.minutesOld ?? 999) - (b.freshness.minutesOld ?? 999));

const summary = {
  generatedAt: new Date().toISOString(),
  sourceStateGeneratedAt: state.meta?.generatedAt,
  posture: state.marketRegime?.posture,
  freshnessPolicy: { staleBlockedAfterMinutes: STALE_BLOCK_MINUTES, cautionAfterMinutes: CAUTION_MINUTES, cadence: 'daily refresh / generate:live' },
  actionNow: reactions.filter(r => r.reaction.priority === 1).map(r => ({ ticker: r.ticker, state: r.reaction.state, permission: r.reaction.permission, price: r.price, read: r.reaction.read })),
  reviewSoon: reactions.filter(r => r.reaction.priority === 2).map(r => ({ ticker: r.ticker, state: r.reaction.state, permission: r.reaction.permission, price: r.price })),
  all: reactions
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
fs.mkdirSync(path.dirname(publicOutPath), { recursive: true });
fs.writeFileSync(publicOutPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ wrote: outPath, generatedAt: summary.generatedAt, freshnessPolicy: summary.freshnessPolicy, actionNow: summary.actionNow, reviewSoon: summary.reviewSoon }, null, 2));
