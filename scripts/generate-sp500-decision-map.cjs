const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const now = new Date().toISOString();
const read = (p, fallback = null) => fs.existsSync(path.join(root, p)) ? JSON.parse(fs.readFileSync(path.join(root, p), 'utf8')) : fallback;
const write = (p, data) => { const f = path.join(root, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(data, null, 2)}\n`); };
const safe = s => String(s).replace(/[^A-Za-z0-9._-]/g, '_').toUpperCase();
const candle = symbol => read(`data/market-candles/${safe(symbol)}.json`, { symbol, candles: [] });
const pct = v => Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
const last = xs => xs[xs.length - 1];
const sma = (xs, n) => xs.length >= n ? xs.slice(-n).reduce((s, x) => s + x.close, 0) / n : null;
const emaSeries = (values, n) => { const k = 2 / (n + 1); let prev = values[0]; return values.map((v, i) => { prev = i ? v * k + prev * (1 - k) : v; return prev; }); };
const rsi = (xs, n = 14) => { if (xs.length <= n) return null; let gains = 0, losses = 0; for (let i = 1; i <= n; i++) { const d = xs[i].close - xs[i - 1].close; gains += Math.max(d, 0); losses += Math.max(-d, 0); } gains /= n; losses /= n; for (let i = n + 1; i < xs.length; i++) { const d = xs[i].close - xs[i - 1].close; gains = (gains * (n - 1) + Math.max(d, 0)) / n; losses = (losses * (n - 1) + Math.max(-d, 0)) / n; } const rs = gains / Math.max(losses, 0.000001); return 100 - 100 / (1 + rs); };
const macd = xs => { const closes = xs.map(x => x.close); if (closes.length < 35) return null; const fast = emaSeries(closes, 12); const slow = emaSeries(closes, 26); const line = fast.map((v, i) => v - slow[i]); const signal = emaSeries(line, 9); return { line: last(line), signal: last(signal), histogram: last(line) - last(signal), priorHistogram: line[line.length - 2] - signal[signal.length - 2] }; };
const bollinger = (xs, n = 20, mult = 2) => { if (xs.length < n) return null; const sl = xs.slice(-n); const mid = sl.reduce((s, x) => s + x.close, 0) / n; const sd = Math.sqrt(sl.reduce((s, x) => s + (x.close - mid) ** 2, 0) / n); return { lower: mid - mult * sd, mid, upper: mid + mult * sd, bandwidthPct: (2 * mult * sd / mid) * 100 }; };
const perf = (xs, n) => xs.length > n ? (last(xs).close / xs[xs.length - 1 - n].close - 1) * 100 : null;
const maxDrawdownFromHigh = xs => { const hi = Math.max(...xs.map(x => x.close)); return (last(xs).close / hi - 1) * 100; };
const classify = (score) => score >= 70 ? 'RISK_ON_TREND' : score >= 55 ? 'SELECTIVE_RISK_ON' : score >= 45 ? 'NEUTRAL_CHOP' : score >= 30 ? 'DEFENSIVE_WATCH' : 'RISK_OFF';

const spy = candle('SPY').candles;
const qqq = candle('QQQ').candles;
const iwm = candle('IWM').candles;
const vix = candle('^VIX').candles;
const btc = candle('BTC-USD').candles;
const live = read('data/report-state.live.json', {});
const rates = live.liveRatesCredit || [];
const rate = id => rates.find(r => r.id === id);
const dgs10 = rate('DGS10');
const hy = rate('BAMLH0A0HYM2');
const symbolsForBreadth = ['SPY','QQQ','IWM','MSFT','AMZN','META','NVDA','AVGO','VRT','GOOGL','CEG','MA','NFLX'];
const breadthRows = symbolsForBreadth.map(s => { const c = candle(s).candles; const l = last(c); return { symbol: s, close: l?.close, above50: l && sma(c, 50) ? l.close > sma(c, 50) : null, above200: l && sma(c, 200) ? l.close > sma(c, 200) : null, perf20: perf(c, 20) }; }).filter(x => x.close);
const breadth50 = breadthRows.filter(x => x.above50).length / Math.max(1, breadthRows.filter(x => x.above50 != null).length) * 100;
const breadth200 = breadthRows.filter(x => x.above200).length / Math.max(1, breadthRows.filter(x => x.above200 != null).length) * 100;

const sp = {
  price: last(spy)?.close,
  date: last(spy)?.time,
  sma20: sma(spy, 20), sma50: sma(spy, 50), sma100: sma(spy, 100), sma200: sma(spy, 200),
  rsi14: rsi(spy, 14), macd: macd(spy), bollinger: bollinger(spy),
  perf5d: perf(spy, 5), perf20d: perf(spy, 20), perf60d: perf(spy, 60), drawdownFrom1yHigh: maxDrawdownFromHigh(spy.slice(-252))
};
const q = { perf20d: perf(qqq, 20), perf60d: perf(qqq, 60), relative20dVsSPY: perf(qqq, 20) - perf(spy, 20), above50: last(qqq)?.close > sma(qqq, 50) };
const small = { perf20d: perf(iwm, 20), relative20dVsSPY: perf(iwm, 20) - perf(spy, 20), above50: last(iwm)?.close > sma(iwm, 50) };
const vol = { vix: last(vix)?.close, vixSma20: sma(vix, 20), vixPerf5d: perf(vix, 5), state: last(vix)?.close >= 22 ? 'STRESS' : last(vix)?.close >= 18 ? 'WATCH' : 'CALM' };
const credit = { tenYear: dgs10?.value, highYieldOas: hy?.value, state: Number(hy?.value) >= 4 ? 'CREDIT_STRESS' : 'CREDIT_CONTAINED', ratePressure: Number(dgs10?.value) >= 4.5 ? 'RATE_PRESSURE_PRESENT' : 'RATE_PRESSURE_MODERATE' };

let score = 50;
const annotations = [];
function add(points, label, evidence, implication) { score += points; annotations.push({ points, label, evidence, implication }); }
if (sp.price > sp.sma20) add(8, 'SPY above 20D trend', `price ${pct(sp.price)} > 20D ${pct(sp.sma20)}`, 'near-term trend constructive'); else add(-8, 'SPY below 20D trend', `price ${pct(sp.price)} < 20D ${pct(sp.sma20)}`, 'near-term trend weakening');
if (sp.price > sp.sma50) add(10, 'SPY above 50D trend', `price ${pct(sp.price)} > 50D ${pct(sp.sma50)}`, 'intermediate trend supports risk'); else add(-12, 'SPY below 50D trend', `price ${pct(sp.price)} < 50D ${pct(sp.sma50)}`, 'intermediate trend blocks risk-on');
if (sp.price > sp.sma200) add(8, 'SPY above 200D regime line', `price ${pct(sp.price)} > 200D ${pct(sp.sma200)}`, 'long-term regime intact'); else add(-18, 'SPY below 200D regime line', `price ${pct(sp.price)} < 200D ${pct(sp.sma200)}`, 'bear/regime risk');
if (sp.rsi14 > 70) add(-7, 'RSI overbought', `RSI14 ${pct(sp.rsi14)}`, 'avoid chasing; prefer pullback or consolidation'); else if (sp.rsi14 < 35) add(6, 'RSI fear/oversold', `RSI14 ${pct(sp.rsi14)}`, 'watch for reversal setup'); else add(2, 'RSI neutral/usable', `RSI14 ${pct(sp.rsi14)}`, 'momentum not at an extreme');
if (sp.macd?.histogram > 0 && sp.macd.histogram > sp.macd.priorHistogram) add(5, 'MACD improving', `hist ${pct(sp.macd.histogram)}`, 'momentum confirmation'); else if (sp.macd?.histogram < 0) add(-5, 'MACD negative', `hist ${pct(sp.macd.histogram)}`, 'momentum caution');
if (q.relative20dVsSPY > 1) add(5, 'Nasdaq leadership', `QQQ 20D vs SPY +${pct(q.relative20dVsSPY)} pts`, 'growth risk appetite leads'); else if (q.relative20dVsSPY < -1) add(-5, 'Nasdaq lagging', `QQQ 20D vs SPY ${pct(q.relative20dVsSPY)} pts`, 'growth appetite weak');
if (small.relative20dVsSPY > 1) add(3, 'Small caps confirming', `IWM 20D vs SPY +${pct(small.relative20dVsSPY)} pts`, 'breadth/risk appetite broadening'); else if (small.relative20dVsSPY < -2) add(-4, 'Small caps lagging', `IWM 20D vs SPY ${pct(small.relative20dVsSPY)} pts`, 'rally may be narrow');
if (breadth50 >= 65) add(6, 'Breadth supportive', `${pct(breadth50)}% proxy basket above 50D`, 'participation supports trend'); else if (breadth50 < 45) add(-8, 'Breadth weak', `${pct(breadth50)}% proxy basket above 50D`, 'narrow/fragile market');
if (vol.state === 'CALM') add(5, 'VIX calm', `VIX ${pct(vol.vix)} vs 20D ${pct(vol.vixSma20)}`, 'volatility not blocking risk'); else if (vol.state === 'WATCH') add(-4, 'VIX watch', `VIX ${pct(vol.vix)}`, 'position size should be moderate'); else add(-12, 'VIX stress', `VIX ${pct(vol.vix)}`, 'defensive posture');
if (credit.state === 'CREDIT_CONTAINED') add(4, 'Credit contained', `HY OAS ${pct(credit.highYieldOas)}`, 'credit not confirming stress'); else add(-10, 'Credit stress', `HY OAS ${pct(credit.highYieldOas)}`, 'risk-off confirmation');
if (credit.ratePressure === 'RATE_PRESSURE_PRESENT') add(-5, 'Rate pressure present', `10Y ${pct(credit.tenYear)}%`, 'multiple expansion constrained');
score = Math.max(0, Math.min(100, Math.round(score)));
const regime = classify(score);
const scenarios = [
  { scenario: 'base_case', label: 'Trend continues but chase risk is elevated', probabilityPct: regime.includes('RISK_ON') ? 55 : regime === 'NEUTRAL_CHOP' ? 45 : 30, conditions: ['SPY holds 20D/50D area', 'VIX remains below stress zone', 'QQQ leadership does not become narrow exhaustion'], portfolioBias: 'Hold core exposure; add only through defined pullbacks / evidence-gated tickers.' },
  { scenario: 'pullback_case', label: 'Healthy pullback / consolidation', probabilityPct: regime.includes('RISK_ON') ? 30 : 35, conditions: ['RSI cools', 'SPY retests 20D or 50D', 'VIX rises but stays below panic'], portfolioBias: 'Prepare add zones; avoid panic if breadth/credit remain stable.' },
  { scenario: 'risk_off_case', label: 'Breakdown / defensive rotation', probabilityPct: regime.includes('RISK_OFF') ? 45 : 15, conditions: ['SPY loses 50D', 'VIX > 22', 'credit spreads widen', 'IWM/QQQ both lag'], portfolioBias: 'Reduce levered/speculative exposure first; preserve cash and core quality only.' }
];
const decision = regime === 'RISK_ON_TREND' ? 'RISK_ON_BUT_DO_NOT_CHASE' : regime === 'SELECTIVE_RISK_ON' ? 'SELECTIVE_RISK_ON_EVIDENCE_GATED' : regime === 'NEUTRAL_CHOP' ? 'NEUTRAL_WAIT_FOR_EDGE' : regime === 'DEFENSIVE_WATCH' ? 'DEFENSIVE_WATCH_REDUCE_BETA' : 'RISK_OFF_PROTECT_CAPITAL';

const baseCase = scenarios.find(s => s.scenario === 'base_case');
const pullbackCase = scenarios.find(s => s.scenario === 'pullback_case');
const riskOffCase = scenarios.find(s => s.scenario === 'risk_off_case');
const distanceTo20 = sp.sma20 ? ((sp.price / sp.sma20) - 1) * 100 : null;
const distanceTo50 = sp.sma50 ? ((sp.price / sp.sma50) - 1) * 100 : null;
const distanceToUpperBand = sp.bollinger?.upper ? ((sp.price / sp.bollinger.upper) - 1) * 100 : null;
const channelRead = distanceTo20 != null && distanceTo50 != null
  ? (distanceTo20 > 3 ? 'extended_above_20d_wait_for_retest' : distanceTo20 >= 0 ? 'constructive_above_20d' : distanceTo50 >= 0 ? 'pullback_to_intermediate_support' : 'below_50d_defensive_watch')
  : 'insufficient_price_structure';
const directionRadar = {
  question: 'Is the S&P 500 trend confirming risk-on, setting up a normal pullback, or warning of risk-off?',
  answer: decision,
  marketDirectionLikelihoods: {
    continuationPct: baseCase?.probabilityPct || 0,
    pullbackConsolidationPct: pullbackCase?.probabilityPct || 0,
    riskOffBreakdownPct: riskOffCase?.probabilityPct || 0
  },
  channelRead,
  nextInflection: distanceTo20 > 3
    ? `SPY is ${pct(distanceTo20)}% above 20D; next useful signal is a 20D retest / hold, not chasing strength.`
    : distanceTo20 >= 0
      ? `SPY remains above 20D by ${pct(distanceTo20)}%; trend is intact while 20D/50D hold.`
      : `SPY is below 20D; watch whether 50D near ${pct(sp.sma50)} holds or fails.`,
  invalidation: 'Risk-on interpretation weakens if SPY loses 50D with VIX > 22, breadth < 45% above 50D, or credit spreads widen.',
  confirmation: 'Risk-on interpretation strengthens if SPY holds/reclaims 20D after cooling, QQQ leadership persists, VIX stays calm, and breadth expands.'
};

const jutopiaMethodPattern = {
  source: 'JUTOPIA reference study from channel @JUTOPIA, especially S&P 500 / Fear & Greed / VIX style market review.',
  extractedMethods: [
    'Start with market direction and allocation posture, not individual ticker excitement.',
    'Compare price structure against sentiment/volatility instead of reading either alone.',
    'Treat Fear & Greed 50 as a regime threshold and 75+ as a bull/late-greed zone, once a sourced adapter exists.',
    'Use VIX as an inverse stress map: 25-30 often marks fear/reversal zones; rising VIX trend warns of correction risk.',
    'Use put/call extremes contrarianly near one-year extremes; ignore noisy middle ranges.',
    'Watch 20D/50D retests after sharp rallies; a 20D hold supports continuation, a 50D loss changes the map.',
    'Translate chart reads into passive/rebalance actions: hold, trim beta, wait for pullback, add only at disciplined zones.'
  ],
  capitalRadarAdaptation: 'Capital Radar should use the method as a structured evidence stack and allocation compass, not as personality-driven chart commentary or trade calls.'
};

const assetBalanceGuidance = [
  { lane: 'Core quality / broad equity', stance: regime.includes('RISK_ON') ? 'hold / maintain' : regime === 'NEUTRAL_CHOP' ? 'hold but avoid adds' : 'protect', rule: 'Core exposure follows the S&P regime unless credit/volatility confirm stress.' },
  { lane: 'Levered / synthetic beta', stance: decision.includes('DO_NOT_CHASE') ? 'no chase; only after pullback confirmation' : regime.includes('RISK_ON') ? 'small, risk-budgeted only' : 'reduce / block', rule: 'Levered products require 20D/50D support, VIX calm, and explicit stop/invalidation.' },
  { lane: 'Speculative growth / crypto beta', stance: small.relative20dVsSPY < -2 ? 'selective / constrained' : 'selective watch', rule: 'Do not let SPX strength alone greenlight fragile beta if breadth is narrow.' },
  { lane: 'Cash / dry powder', stance: distanceTo20 > 3 ? 'keep dry powder for retest' : 'deploy only into cleared evidence gates', rule: 'Cash is an option on pullbacks and evidence gaps, not idle failure.' },
  { lane: 'Opportunity Scout', stance: 'research-only until promoted', rule: 'Market map may raise research priority, but ticker evidence/risk budget still decides action.' }
];

const visualBlueprint = {
  title: 'S&P 500 Direction Radar',
  focalPoint: 'One annotated SPY/SPX chart as the star, with evidence strips orbiting it.',
  panels: [
    { panel: 'Main SPY chart', annotations: ['20D/50D/200D regime lines', 'current price badge', 'pullback/retest zone', 'risk-off invalidation zone', 'upper-band/chase-risk zone'] },
    { panel: 'Sentiment / volatility strip', annotations: ['VIX spot vs 20D', 'future Fear & Greed 50/75 markers', 'future put/call extreme markers'] },
    { panel: 'Participation strip', annotations: ['QQQ leadership', 'IWM confirmation/lag', 'breadth above 50D/200D'] },
    { panel: 'Macro pressure strip', annotations: ['10Y yield constraint', 'HY OAS credit stress threshold'] },
    { panel: 'Scenario rail', annotations: ['continuation probability', 'pullback probability', 'risk-off probability', 'trigger checklist'] },
    { panel: 'Portfolio translation', annotations: ['core stance', 'levered stance', 'cash/dry-powder stance', 'blocked actions'] }
  ],
  designGate: 'needs_design_validation_until_rendered_and_screenshot_checked',
  nonNegotiable: 'The chart must show uncertainty and trigger levels; never imply certain prediction or automatic trade execution.'
};

const map = {
  generatedAt: now,
  artifact: 'sp500-market-decision-map',
  version: 1,
  status: 'SOURCE_LIMITED_PUBLIC_MARKET_DATA',
  purpose: 'Annotated market-direction decision map inspired by chart-reader workflows: combine SPY/SPX trend, Nasdaq leadership, breadth, fear/volatility, rates, credit, and portfolio translation.',
  sourceBoundary: 'Uses public/unofficial Yahoo chart candles plus FRED rates/credit from Capital Radar. Fear & Greed is modeled as a required future adapter, not claimed unless sourced.',
  headline: `${decision}: score ${score}/100`,
  score,
  regime,
  decision,
  chartPanels: [
    { id: 'spy_price_structure', title: 'S&P 500 / SPY price structure', overlays: ['20D/50D/100D/200D moving averages', 'Bollinger bands', 'support/resistance zones', 'annotated breakout/pullback areas'], currentRead: `SPY ${pct(sp.price)}; 20D ${pct(sp.sma20)}, 50D ${pct(sp.sma50)}, 200D ${pct(sp.sma200)}.` },
    { id: 'momentum', title: 'Momentum', overlays: ['RSI14', 'MACD histogram'], currentRead: `RSI14 ${pct(sp.rsi14)}, MACD hist ${pct(sp.macd?.histogram)}.` },
    { id: 'fear_greed_volatility', title: 'Fear / Greed / VIX', overlays: ['VIX spot and 20D average', 'future CNN Fear & Greed adapter', 'put/call ratio future adapter'], currentRead: `VIX ${pct(vol.vix)} (${vol.state}).` },
    { id: 'participation', title: 'Participation / breadth', overlays: ['QQQ vs SPY', 'IWM vs SPY', 'proxy basket above 50D/200D'], currentRead: `${pct(breadth50)}% proxy basket above 50D, ${pct(breadth200)}% above 200D.` },
    { id: 'macro_constraints', title: 'Rates / credit constraints', overlays: ['10Y Treasury', 'HY OAS'], currentRead: `10Y ${pct(credit.tenYear)}%, HY OAS ${pct(credit.highYieldOas)}.` },
    { id: 'portfolio_translation', title: 'Portfolio translation', overlays: ['core quality', 'levered/synthetic', 'opportunity candidates'], currentRead: 'Route can be selective, but ticker adds remain evidence/risk-budget gated.' }
  ],
  annotations,
  scenarios,
  triggerLevels: {
    constructive: ['SPY holds 20D/50D trend area', 'QQQ leadership stays positive without VIX expansion', 'breadth proxy stays > 60% above 50D'],
    caution: ['RSI > 70 near upper Bollinger band', 'IWM lags while SPY makes highs', '10Y continues rising above 4.5%'],
    defensive: ['SPY breaks 50D with negative MACD', 'VIX > 22', 'HY OAS widens toward stress', 'breadth proxy < 45% above 50D']
  },
  portfolioTranslation: {
    currentBias: decision,
    allowed: ['Hold core exposure', 'Use pullbacks to evaluate evidence-gated adds', 'Prioritize risk budgets before any levered/speculative exposure change'],
    blocked: ['Do not chase index strength without pullback/zone', 'Do not promote opportunities from chart signal alone', 'Do not add levered products without explicit risk budget'],
    rebalanceImplication: regime.includes('RISK_ON') ? 'Maintain exposure, but shift from broad enthusiasm to selective evidence-backed adds.' : regime.includes('DEFENSIVE') || regime.includes('RISK_OFF') ? 'Reduce beta/levered exposure before core quality.' : 'Wait for clearer edge before changing allocation.'
  },
  directionRadar,
  jutopiaMethodPattern,
  assetBalanceGuidance,
  visualBlueprint,
  data: { sp, qqq: q, iwm: small, volatility: vol, breadth: { breadth50Pct: pct(breadth50), breadth200Pct: pct(breadth200), rows: breadthRows }, credit },
  nextAdapters: ['CNN Fear & Greed current/timeline', 'CBOE put/call ratio', 'advance/decline breadth', 'sector rotation heatmap', 'support/resistance swing-point detector', 'annotation renderer for chart-cognition page'],
  sourceArtifacts: ['data/market-candles/SPY.json', 'data/market-candles/QQQ.json', 'data/market-candles/IWM.json', 'data/market-candles/_VIX.json', 'data/report-state.live.json']
};
write('outputs/sp500-market-decision-map.json', map);
fs.mkdirSync(path.join(root, 'public', 'outputs'), { recursive: true });
fs.writeFileSync(path.join(root, 'public', 'outputs', 'sp500-market-decision-map.json'), `${JSON.stringify(map, null, 2)}\n`);
const html = `<!doctype html><html><head><meta charset="utf-8"><title>S&P 500 Direction Radar</title><style>body{margin:0;background:#080b12;color:#edf2ff;font-family:Inter,Arial,sans-serif}.wrap{max-width:1180px;margin:0 auto;padding:32px}.hero{border:1px solid #283142;background:linear-gradient(135deg,#111827,#0b1220);border-radius:24px;padding:28px;margin-bottom:18px}.kicker{color:#7dd3fc;text-transform:uppercase;letter-spacing:.14em;font-size:12px}.headline{font-size:34px;font-weight:760;margin:8px 0}.grid{display:grid;grid-template-columns:1.4fr .9fr;gap:18px}.card{border:1px solid #253044;background:#0f1624;border-radius:20px;padding:20px}.score{font-size:52px;font-weight:800}.muted{color:#aab7cf}.pill{display:inline-block;border:1px solid #334155;border-radius:999px;padding:6px 10px;margin:4px 6px 4px 0;color:#dbeafe}.prob{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.prob div{background:#111c2f;border-radius:14px;padding:12px}.bars{display:grid;gap:8px}.bar{height:12px;background:#1f2937;border-radius:999px;overflow:hidden}.fill{height:100%;background:linear-gradient(90deg,#38bdf8,#22c55e)}ul{padding-left:18px;line-height:1.55}.panels{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}@media(max-width:850px){.grid,.panels{grid-template-columns:1fr}.headline{font-size:26px}}</style></head><body><main class="wrap"><section class="hero"><div class="kicker">Capital Radar ┬╖ S&P 500 Direction Radar</div><div class="headline">${map.headline}</div><p class="muted">${directionRadar.question}</p><span class="pill">Regime: ${regime}</span><span class="pill">Decision: ${decision}</span><span class="pill">Channel: ${channelRead}</span></section><section class="grid"><div class="card"><div class="kicker">Main read</div><div class="score">${score}/100</div><p>${directionRadar.nextInflection}</p><p class="muted"><b>Confirmation:</b> ${directionRadar.confirmation}</p><p class="muted"><b>Invalidation:</b> ${directionRadar.invalidation}</p><div class="prob"><div><b>${directionRadar.marketDirectionLikelihoods.continuationPct}%</b><br><span class="muted">Continuation</span></div><div><b>${directionRadar.marketDirectionLikelihoods.pullbackConsolidationPct}%</b><br><span class="muted">Pullback / chop</span></div><div><b>${directionRadar.marketDirectionLikelihoods.riskOffBreakdownPct}%</b><br><span class="muted">Risk-off</span></div></div></div><div class="card"><div class="kicker">Portfolio balance</div><ul>${assetBalanceGuidance.map(x=>`<li><b>${x.lane}:</b> ${x.stance}<br><span class="muted">${x.rule}</span></li>`).join('')}</ul></div></section><section class="card" style="margin-top:18px"><div class="kicker">Annotated evidence stack</div><div class="panels">${map.chartPanels.map(p=>`<div><h3>${p.title}</h3><p class="muted">${p.currentRead}</p>${p.overlays.map(o=>`<span class="pill">${o}</span>`).join('')}</div>`).join('')}</div></section><section class="card" style="margin-top:18px"><div class="kicker">JUTOPIA-derived method pattern</div><ul>${jutopiaMethodPattern.extractedMethods.map(x=>`<li>${x}</li>`).join('')}</ul></section></main></body></html>`;
fs.writeFileSync(path.join(root, 'outputs', 'sp500-direction-radar.html'), html);
fs.writeFileSync(path.join(root, 'public', 'outputs', 'sp500-direction-radar.html'), html);
console.log(JSON.stringify({ ok: true, generatedAt: now, headline: map.headline, regime, decision, score, topAnnotations: annotations.slice(0, 6) }, null, 2));
