const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const reactionPath = path.join(root, 'outputs', 'live-reaction-state.json');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const coveragePath = path.join(root, 'outputs', 'portfolio-thesis-coverage-map.json');
const memoPath = path.join(root, 'outputs', 'ic-decision-memos.json');
const outPath = path.join(root, 'outputs', 'authoritative-action-state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const reaction = fs.existsSync(reactionPath) ? JSON.parse(fs.readFileSync(reactionPath, 'utf8')) : { reactions: [] };
const interp = fs.existsSync(interpPath) ? JSON.parse(fs.readFileSync(interpPath, 'utf8')) : { interpretations: [] };
const coverage = fs.existsSync(coveragePath) ? JSON.parse(fs.readFileSync(coveragePath, 'utf8')) : { holdings: [] };
const memos = fs.existsSync(memoPath) ? JSON.parse(fs.readFileSync(memoPath, 'utf8')) : { memos: [] };
const n = v => { if (v === null || v === undefined || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
const precisionFor = v => { const x = Math.abs(Number(v)); if (!Number.isFinite(x)) return 2; if (x < 0.01) return 8; if (x < 1) return 6; if (x < 10) return 3; return 2; };
const roundLevel = (v, ref) => { const d = precisionFor(ref ?? v); return Number(Number(v).toFixed(d)); };
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const reactionByTicker = new Map((reaction.reactions || reaction.holdings || []).map(r => [String(r.ticker || '').toUpperCase(), r]));
const interpByTicker = new Map((interp.interpretations || []).map(i => [String(i.ticker || '').toUpperCase(), i]));
const coverageByTicker = new Map((coverage.holdings || []).map(c => [String(c.ticker || '').toUpperCase(), c]));
const memoByTicker = new Map((memos.memos || []).map(m => [String(m.ticker || '').toUpperCase(), m]));
function levelSet(h, i) {
  const t = h.signalThresholds || {};
  const fixed = h.actionBands || h.priceLevels || h.technicalMap || {};
  const price = n(h.livePrice);
  const addLow = n(fixed.buyLow ?? fixed.buyZoneLow ?? fixed.addLow ?? fixed.addBelow ?? t.addPrice);
  const addHigh = n(fixed.buyHigh ?? fixed.buyZoneHigh ?? fixed.addHigh ?? fixed.buyAbove ?? null);
  const trimLow = n(fixed.trimLow ?? fixed.sellLow ?? t.trimPrice);
  const trimHigh = n(fixed.trimHigh ?? fixed.target ?? null);
  const stop = n(fixed.stopReview ?? fixed.stop ?? t.riskReviewPrice ?? null);
  const hardExitRaw = n(fixed.hardExit ?? fixed.exit ?? null);
  const hardExit = hardExitRaw != null ? hardExitRaw : (stop != null ? roundLevel(stop * 0.97, price ?? stop) : null);
  const pctWidth = (pct, fallback) => Math.max(Math.abs(n(pct) ?? fallback), fallback);
  const addWidth = price != null ? roundLevel(price * pctWidth(t.addPct, 1.5) / 100 * 0.25, price) : 0;
  const trimWidth = price != null ? roundLevel(price * pctWidth(t.trimPct, 5) / 100 * 0.2, price) : 0;
  return {
    addZone: {
      low: addLow != null ? roundLevel(addLow - addWidth, price ?? addLow) : null,
      high: addLow != null ? roundLevel((addHigh ?? addLow) + addWidth, price ?? addLow) : null,
      source: addLow != null ? 'ticker_specific_volatility_threshold' : 'missing'
    },
    trimZone: {
      low: trimLow != null ? roundLevel(trimLow - trimWidth, price ?? trimLow) : null,
      high: trimLow != null ? roundLevel((trimHigh ?? trimLow) + trimWidth, price ?? trimLow) : null,
      source: trimLow != null ? 'ticker_specific_volatility_threshold' : 'missing'
    },
    stopReview: stop,
    hardExit,
    volatility: {
      addPrice: n(t.addPrice), addPct: n(t.addPct), trimPrice: n(t.trimPrice), trimPct: n(t.trimPct), riskReviewPrice: n(t.riskReviewPrice), riskReviewPct: n(t.riskReviewPct), formula: t.formula || null, exposureType: t.exposureType || null
    },
    nearestBoundary: i?.nearestDecisionBoundary || null
  };
}
function classifyZone(price, levels) {
  const hardExit = n(levels.hardExit);
  const stop = n(levels.stopReview);
  const addLow = n(levels.addZone.low);
  const addHigh = n(levels.addZone.high);
  const trimLow = n(levels.trimZone.low);
  const trimHigh = n(levels.trimZone.high);
  if (hardExit != null && price <= hardExit) return { state: 'BELOW_HARD_EXIT', tone: 'danger', label: `Below hard exit ${hardExit}` };
  if (stop != null && price <= stop) return { state: 'STOP_REVIEW', tone: 'danger', label: `At/below stop review ${stop}` };
  if (addLow != null && addHigh != null && price >= Math.min(addLow, addHigh) && price <= Math.max(addLow, addHigh)) return { state: 'IN_BUY_REVIEW_ZONE', tone: 'positive', label: `Inside buy review zone ${addLow}-${addHigh}` };
  if (addLow != null && price < addLow) return { state: 'BELOW_BUY_ZONE', tone: 'caution', label: `Below buy zone ${addLow}` };
  if (trimLow != null && trimHigh != null && price >= Math.min(trimLow, trimHigh) && price <= Math.max(trimLow, trimHigh)) return { state: 'IN_TRIM_REVIEW_ZONE', tone: 'caution', label: `Inside trim zone ${trimLow}-${trimHigh}` };
  if (trimHigh != null && price > trimHigh) return { state: 'ABOVE_TARGET_TRIM', tone: 'caution', label: `Above trim/target ${trimHigh}` };
  return { state: 'BETWEEN_LEVELS', tone: 'neutral', label: 'Between major action levels' };
}
function decide(h, reactionRow, i, c, m, levels, zone) {
  const signal = String(h.computedSignal || h.signal || '').toUpperCase();
  const reactionState = String(reactionRow?.state || reactionRow?.reactionState || '').toUpperCase();
  const reactionPermission = String(reactionRow?.permission || reactionRow?.actionPermission || '');
  const interpPermission = String(i?.actionPermission?.status || '');
  if (zone.state === 'BELOW_HARD_EXIT' || reactionState.includes('HARD_EXIT') || signal.includes('EXIT')) {
    return { decision: 'EXIT REVIEW', tone: 'danger', urgency: 'IMMEDIATE', allowed: 'Review exit / reduce risk only.', forbidden: 'Do not add or average down.', reason: zone.state === 'BELOW_HARD_EXIT' ? `Price is below hard exit; buy zone is invalidated.` : 'Exit-review signal overrides price proximity.' };
  }
  if (signal.includes('TRIM') || reactionState.includes('TRIM')) return { decision: 'TRIM REVIEW', tone: 'danger', urgency: 'THIS WEEK', allowed: 'Review trim / rebalance only.', forbidden: 'Do not add until trim watch clears.', reason: 'Trim-watch state overrides add-zone proximity.' };
  if (signal.includes('INVESTIGATE') || /NO ACTION|VERIFY/i.test(`${reactionPermission} ${interpPermission}`)) return { decision: 'VERIFY FIRST', tone: 'caution', urgency: 'SOON', allowed: 'Research / verification only.', forbidden: 'No capital action until verification clears.', reason: 'Investigate or verification state blocks trading action.' };
  if (c?.coverageState === 'constrained' || c?.blockedForAction) return { decision: 'CAPITAL BLOCKED', tone: 'danger', urgency: 'SOON', allowed: 'Hold or reduce-risk review only.', forbidden: 'No add until constraint clears.', reason: 'Coverage state is constrained; documentation is not permission.' };
  if (zone.state === 'IN_BUY_REVIEW_ZONE' && /Add review allowed/i.test(interpPermission)) return { decision: 'ADD REVIEW ALLOWED', tone: 'positive', urgency: 'REVIEW', allowed: 'Review add only if thesis/evidence/risk gates remain clean.', forbidden: 'Do not execute automatically from price alone.', reason: 'Price is in buy review zone and permission is open.' };
  if (zone.state === 'BELOW_BUY_ZONE') return { decision: 'WAIT FOR RECLAIM', tone: 'caution', urgency: 'MONITOR', allowed: 'Wait for reclaim or explicit capitulation-bounce rule.', forbidden: 'Do not assume below buy zone means better buy.', reason: 'Price is below buy zone but not below hard exit; reclaim confirmation required.' };
  if (/Hold only/i.test(interpPermission)) return { decision: 'HOLD ONLY', tone: 'caution', urgency: 'MONITOR', allowed: 'Hold and monitor.', forbidden: 'No add due to risk budget or permission block.', reason: 'Strategy interpreter blocks add permission.' };
  return { decision: 'HOLD / MONITOR', tone: 'neutral', urgency: 'MONITOR', allowed: 'Monitor against levels and thesis.', forbidden: 'No automatic action.', reason: 'No immediate permission-changing condition detected.' };
}
function priceLadder(price, levels, authority) {
  const raw = [
    { key: 'trimHigh', label: 'Trim high / target', price: n(levels.trimZone.high), role: 'trim' },
    { key: 'trimLow', label: 'Trim review', price: n(levels.trimZone.low), role: 'trim' },
    { key: 'addHigh', label: 'Buy review high', price: n(levels.addZone.high), role: authority.decision.includes('EXIT') ? 'invalidated' : 'add' },
    { key: 'addLow', label: 'Buy review low', price: n(levels.addZone.low), role: authority.decision.includes('EXIT') ? 'invalidated' : 'add' },
    { key: 'stopReview', label: 'Stop / review', price: n(levels.stopReview), role: 'risk' },
    { key: 'hardExit', label: 'Hard exit', price: n(levels.hardExit), role: 'danger' },
    { key: 'current', label: 'Current price', price, role: authority.tone }
  ].filter(x => x.price != null);
  const max = Math.max(...raw.map(x => x.price));
  const min = Math.min(...raw.map(x => x.price));
  return raw.sort((a,b) => b.price - a.price).map(x => ({ ...x, pctOfRange: max === min ? 50 : Math.round(((x.price - min) / (max - min)) * 100) }));
}
const actionStates = holdings.map(h => {
  const ticker = String(h.ticker || '').toUpperCase();
  const price = n(h.livePrice);
  const reactionRow = reactionByTicker.get(ticker);
  const i = interpByTicker.get(ticker);
  const c = coverageByTicker.get(ticker);
  const m = memoByTicker.get(ticker);
  const levels = levelSet(h, i);
  const zone = classifyZone(price, levels);
  const authority = decide(h, reactionRow, i, c, m, levels, zone);
  return {
    ticker,
    price,
    signal: h.computedSignal || h.signal || 'Review',
    zone,
    authority,
    levels,
    priceLadder: priceLadder(price, levels, authority),
    sourceRefs: { reaction: !!reactionRow, strategyInterpretation: !!i, thesisCoverage: !!c, icMemo: !!m },
    moduleDirective: {
      buyZoneLabel: authority.decision === 'EXIT REVIEW' ? 'Buy zone invalidated' : 'Buy review zone',
      chartBadge: `${authority.decision} · ${authority.urgency}`,
      actionBandOverride: authority.decision === 'EXIT REVIEW' ? 'Current price is below hard exit. Green add/buy bands are disabled until state clears.' : authority.reason,
      proximityEligible: authority.decision === 'ADD REVIEW ALLOWED'
    }
  };
});
const summary = {
  total: actionStates.length,
  immediate: actionStates.filter(x => x.authority.urgency === 'IMMEDIATE').map(x => x.ticker),
  blocked: actionStates.filter(x => /EXIT|TRIM|VERIFY|BLOCKED|HOLD ONLY|WAIT/i.test(x.authority.decision)).map(x => x.ticker),
  addReviewAllowed: actionStates.filter(x => x.authority.decision === 'ADD REVIEW ALLOWED').map(x => x.ticker),
  contradictionsPrevented: actionStates.filter(x => x.moduleDirective.buyZoneLabel.includes('invalidated')).map(x => x.ticker)
};
const result = { generatedAt: new Date().toISOString(), layer: 'authoritative-action-state', policy: 'All modules must obey this action state. Price zones are review zones only; exit/hard-stop states override add proximity.', summary, actionStates };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`generated authoritative action state: ${summary.immediate.length} immediate / ${summary.addReviewAllowed.length} add-review / ${summary.blocked.length} blocked`);
