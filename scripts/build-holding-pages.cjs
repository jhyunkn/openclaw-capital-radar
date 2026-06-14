const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const { strategyFor, numericLevels } = require('./capital-radar-strategy-rules.cjs');
const outDir = path.join(root, 'pages');
fs.mkdirSync(outDir, { recursive: true });

const fundamentalsPath = path.join(root, 'data', 'fundamentals.manual.json');
const fundamentals = fs.existsSync(fundamentalsPath)
  ? JSON.parse(fs.readFileSync(fundamentalsPath, 'utf8')).metrics || {}
  : {};

function computeSubstanceFloor(ticker, livePrice) {
  const f = fundamentals[ticker] || {};
  if (f.notApplicable) return { notApplicable: true, reason: f.reason };
  const forwardPE = f.forwardPE;
  if (!forwardPE || !livePrice) return null;
  const eps = livePrice / forwardPE;
  const floor15 = Math.round(eps * 15 * 100) / 100;
  const floor18 = Math.round(eps * 18 * 100) / 100;
  const balloon = Math.round((livePrice - floor15) * 100) / 100;
  const balloonPct = Math.round((balloon / floor15) * 1000) / 10;
  const substancePct = Math.round((floor15 / livePrice) * 1000) / 10;
  let label, cycleRead;
  if (balloonPct < 30) {
    label = 'Near substance floor';
    cycleRead = 'Phase B–C: buying mostly substance, little hope premium';
  } else if (balloonPct < 70) {
    label = 'Moderate hope premium';
    cycleRead = 'Phase C: reasonable expectation baked in';
  } else if (balloonPct < 130) {
    label = 'Significant hope premium';
    cycleRead = 'Phase C–D: meaningful future expectations priced in';
  } else if (balloonPct < 220) {
    label = 'Heavy hope premium';
    cycleRead = 'Phase D: market pricing strong future growth';
  } else {
    label = 'Extreme hope premium';
    cycleRead = 'Phase D–E: caution — most of price is expectation, not substance';
  }
  return { forwardPE, eps: Math.round(eps * 100) / 100, floor15, floor18, balloon, balloonPct, substancePct, label, cycleRead };
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 }) : 'n/a';
const price = n => n == null ? 'n/a' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 })}`;
const pct = n => typeof n === 'number' ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : 'n/a';
const money = n => typeof n === 'number' ? `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'n/a';
const tone = n => typeof n !== 'number' ? '' : n >= 0 ? 'good' : 'bad';
const list = value => Array.isArray(value) ? value : [];
const holdings = list(state.holdings);

function tvSymbol(ticker) {
  const t = String(ticker || '').toUpperCase();
  const map = {
    SPY: 'AMEX:SPY', QQQ: 'NASDAQ:QQQ', IWM: 'AMEX:IWM', IBIT: 'NASDAQ:IBIT',
    MSFT: 'NASDAQ:MSFT', AMZN: 'NASDAQ:AMZN', META: 'NASDAQ:META', NVDA: 'NASDAQ:NVDA', GOOGL: 'NASDAQ:GOOGL', NFLX: 'NASDAQ:NFLX',
    GEV: 'NYSE:GEV', CEG: 'NASDAQ:CEG', MA: 'NYSE:MA', AVGO: 'NASDAQ:AVGO', VRT: 'NYSE:VRT',
    CONL: 'NASDAQ:CONL', TSLT: 'NASDAQ:TSLT', TSNF: 'NASDAQ:TSNF', BMNR: 'AMEX:BMNR',
    'BTC-USD': 'BITSTAMP:BTCUSD', 'ETH-USD': 'BITSTAMP:ETHUSD', '^VIX': 'CBOE:VIX'
  };
  return map[t] || `NASDAQ:${t}`;
}

function compactNum(n) {
  return typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: n > 1000 ? 0 : 2 }) : 'n/a';
}
function hasValue(v) { return v !== null && v !== undefined && v !== ''; }
function signalTone(signal) {
  const s = String(signal || '').toUpperCase();
  if (s.includes('EXIT') || s.includes('TRIM')) return 'bad';
  if (s.includes('INVESTIGATE') || s.includes('WATCH')) return 'warn';
  return 'good';
}
function contractValue(h, field) { return h?.dataContract?.[field]; }
function contractConfidence(h, field) { return h?.dataContract?.confidence?.[field] || 'missing'; }

function tradingViewChart(h) {
  const symbol = tvSymbol(h.ticker);
  const containerId = `tradingview_${String(h.ticker).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const fallback = h.chart?.path
    ? `<details class="fallback-chart"><summary>Static external chart snapshot</summary><a href="${esc(h.finviz?.quoteUrl || '#')}" target="_blank" rel="noreferrer"><img loading="lazy" class="realchart" src="/${esc(h.chart.path)}" alt="${esc(h.ticker)} external market chart snapshot"></a></details>`
    : '<p class="note">No static external chart snapshot available.</p>';
  return `<div class="tv-wrap" data-tv-symbol="${esc(symbol)}" data-tv-container="${containerId}"><div class="tv-placeholder"><span class="label">Live chart on demand</span><p>Load the real TradingView market-data chart only when needed. The page stays readable without the heavy widget.</p><button class="load-tv" type="button">Load live chart</button></div><div id="${containerId}" class="tvchart" hidden></div></div>${fallback}`;
}

function flowPanel(h) {
  const p = h.finviz?.parsed || {};
  const im = h.finviz?.implication || {};
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">Evidence</p><h2>Flow / technical read</h2></div></div><div class="data-grid six"><article><span>Relative volume</span><b>${compactNum(p.relVolume)}x</b></article><article><span>Volume / avg</span><b>${compactNum(p.volume)} / ${compactNum(p.avgVolume)}</b></article><article><span>RSI</span><b>${compactNum(p.rsi)}</b></article><article><span>Inst own</span><b>${compactNum(p.instOwn)}%</b></article><article><span>Short float</span><b>${compactNum(p.shortFloat)}%</b></article><article><span>ATR</span><b>${price(p.atr)}</b></article></div><p class="bodyline"><b>${esc(im.flow || 'Flow unavailable')}</b> · ${esc(im.trend || 'Trend unavailable')} · ${esc(im.institutional || 'Institutional data unavailable')} · ${esc(im.shortInterest || 'Short-interest unavailable')}</p></section>`;
}

function actionBandHtml(levels) {
  return `<div class="data-grid six action-grid"><article><span>Buy zone</span><b class="good">${price(levels.entryLow)}–${price(levels.entryHigh)}</b></article><article><span>Add below</span><b class="good">${price(levels.addBelow)}</b></article><article><span>Sell / trim</span><b class="warn">${price(levels.trimLow)}–${price(levels.trimHigh)}</b></article><article><span>Stop / review</span><b class="bad">${price(levels.stop)}</b></article><article><span>Hard exit</span><b class="bad">${price(levels.hardExit)}</b></article><article><span>Target</span><b>${price(levels.target)}</b></article></div>`;
}

function portfolioNav(currentTicker) {
  return `<section class="section nav-section"><div class="section-head"><div><p class="eyebrow">Portfolio navigation</p><h2>Move through holdings</h2></div></div><div class="ticker-nav">${holdings.map(item => `<a class="${item.ticker === currentTicker ? 'active' : ''}" href="${String(item.ticker).toLowerCase()}.html"><b>${esc(item.ticker)}</b><span>${esc(item.computedSignal || item.signal || 'Review')}</span></a>`).join('')}</div></section>`;
}

function dataQualityPanel(h) {
  const rows = [
    ['Forward PE', contractValue(h, 'forwardPE'), contractConfidence(h, 'forwardPE')],
    ['FCF Yield', contractValue(h, 'fcfYield'), contractConfidence(h, 'fcfYield')],
    ['Next earnings', contractValue(h, 'nextEarningsDate'), contractConfidence(h, 'nextEarningsDate')],
    ['Price as of', h.priceAsOf || h.asOf || h.finviz?.asOf, hasValue(h.priceAsOf || h.asOf || h.finviz?.asOf) ? 'available' : 'missing']
  ];
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">Data quality</p><h2>What the agent knows</h2></div></div><div class="data-grid four quality-grid">${rows.map(([label, value, confidence]) => `<article><span>${esc(label)}</span><b>${hasValue(value) ? esc(value) : '—'}</b><em class="quality ${esc(confidence)}">${esc(confidence)}</em></article>`).join('')}</div><p class="bodyline">Missing values are explicit. The system should not fabricate fundamentals, earnings dates, or source timestamps.</p></section>`;
}

function fundamentalFloorPanel(h) {
  const floor = computeSubstanceFloor(h.ticker, h.livePrice);
  if (!floor) return `<section class="section"><div class="section-head"><div><p class="eyebrow">Substanzwert · Substance floor</p><h2>Price composition</h2></div></div><p>No forward PE data available — substance floor cannot be computed.</p></section>`;
  if (floor.notApplicable) return `<section class="section"><div class="section-head"><div><p class="eyebrow">Substanzwert · Substance floor</p><h2>Price composition</h2></div></div><p class="bodyline">${esc(floor.reason)}</p></section>`;
  const subW = Math.round(Math.max(2, Math.min(98, floor.substancePct)) * 10) / 10;
  const hopW = Math.round((100 - subW) * 10) / 10;
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">Substanzwert · Substance floor</p><h2>Price composition</h2></div></div><div class="balloon-bar-wrap"><div class="balloon-bar"><div class="balloon-seg substance" style="width:${subW}%"><span>Substance ${floor.substancePct}%</span></div><div class="balloon-seg hope" style="width:${hopW}%"><span>Hope ${(100 - floor.substancePct).toFixed(1)}%</span></div></div><div class="balloon-labels"><span class="balloon-label-left">$0</span><span class="balloon-label-floor">$${floor.floor15} floor (15× EPS)</span><span class="balloon-label-right">${price(h.livePrice)} current</span></div></div><div class="data-grid four" style="margin-top:0"><article><span>Substance floor (15×)</span><b class="good">${price(floor.floor15)}</b></article><article><span>Quality floor (18×)</span><b>${price(floor.floor18)}</b></article><article><span>Hope balloon</span><b class="warn">+${price(floor.balloon)}</b></article><article><span>Balloon / floor</span><b class="warn">+${floor.balloonPct}%</b></article></div><p class="bodyline"><b>${esc(floor.label)}</b> · ${esc(floor.cycleRead)}</p><p class="bodyline label">Floor uses 15× as a conservative no-growth multiple (EPS implied = price ÷ fwd PE = $${floor.eps}). Everything above the floor is the market pricing future expectations — Kostolany's <em>Hoffnungswert</em>. The quality floor at 18× applies to high-predictability compounders.</p></section>`;
}

function companyFundamentalsPanel(h) {
  const dc = h.dataContract || {};
  const xbrl = dc.xbrl;
  const f = dc;
  const na = dc.notApplicable;
  if (na) return `<section class="section"><div class="section-head"><div><p class="eyebrow">Company fundamentals</p><h2>Financials</h2></div></div><p class="bodyline">${esc(dc.reason || 'Fundamentals not applicable for this instrument.')}</p></section>`;
  const bn = v => v == null ? 'n/a' : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}M`;
  const pct2 = v => v == null ? 'n/a' : `${Number(v).toFixed(1)}%`;
  const hasXbrl = !!xbrl;
  const revenueRow = hasXbrl && xbrl.revenueTtmM != null
    ? `<article><span>Revenue TTM</span><b>$${(xbrl.revenueTtmM / 1000).toFixed(1)}B</b></article><article><span>Revenue growth</span><b class="${xbrl.revenueGrowthPct >= 15 ? 'good' : xbrl.revenueGrowthPct >= 5 ? '' : 'bad'}">${pct2(xbrl.revenueGrowthPct)}</b></article>` : '';
  const marginRow = `<article><span>Gross margin</span><b>${pct2(f.grossMarginPct)}</b></article><article><span>Operating margin</span><b>${pct2(f.operatingMarginPct)}</b></article><article><span>Net margin</span><b>${pct2(f.netMarginPct)}</b></article>`;
  const earningsRow = hasXbrl ? `<article><span>EPS (diluted)</span><b>${xbrl.epsDiluted != null ? `$${xbrl.epsDiluted}` : 'n/a'}</b></article><article><span>FCF TTM</span><b>${xbrl.fcfM != null ? `$${(xbrl.fcfM / 1000).toFixed(1)}B` : 'n/a'}</b></article><article><span>LT Debt</span><b>${xbrl.longTermDebtM != null ? `$${(xbrl.longTermDebtM / 1000).toFixed(1)}B` : 'n/a'}</b></article>` : '';
  const mcapRow = dc.marketCapB != null ? `<article><span>Market cap</span><b>$${dc.marketCapB}B</b></article>` : '';
  const fiftyTwo = (h.fiftyTwoWeekHigh != null && h.fiftyTwoWeekLow != null)
    ? `<article><span>52-week range</span><b>${price(h.fiftyTwoWeekLow)} – ${price(h.fiftyTwoWeekHigh)}</b></article>` : '';
  const filingNote = hasXbrl ? `<p class="bodyline label">XBRL source: ${esc(xbrl.source)} · Fiscal year ending ${esc(xbrl.latestFiscalYear)} · Filed ${esc(xbrl.latestFilingDate)}</p>` : '<p class="bodyline label">XBRL data not available for this ticker. Margin figures are manually estimated.</p>';
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">Company fundamentals</p><h2>Financials</h2></div></div><div class="data-grid four">${revenueRow}${marginRow}${earningsRow}${mcapRow}${fiftyTwo}</div>${filingNote}</section>`;
}

function analystConsensusPanel(h) {
  const dc = h.dataContract || {};
  if (dc.notApplicable || dc.analystRating == null) return '';
  const noTarget = dc.analystTargetMean == null;
  const targetBar = !noTarget ? `<div class="analyst-bar-wrap"><div style="display:flex;gap:16px;align-items:center;margin-top:14px"><span style="color:var(--muted);font-size:14px">Target range</span><b style="color:var(--green)">${price(dc.analystTargetLow)}</b><span style="flex:1;height:6px;background:linear-gradient(90deg,var(--green),var(--warn));border-radius:3px;position:relative"><span style="position:absolute;left:50%;top:-10px;font-size:12px;color:var(--muted)">↑ mean ${price(dc.analystTargetMean)}</span></span><b style="color:var(--warn)">${price(dc.analystTargetHigh)}</b></div></div>` : '';
  const round2 = v => typeof v === 'number' ? Math.round(v * 100) / 100 : null;
  const upside = dc.analystTargetMean != null && h.livePrice ? round2(((dc.analystTargetMean / h.livePrice) - 1) * 100) : null;
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">Analyst consensus</p><h2>${esc(dc.analystRating || 'No rating')}</h2></div><span class="label">${dc.analystCount ? `${dc.analystCount} analysts` : 'No coverage'} · as of ${esc(dc.analystDataAsOf || '?')}</span></div><div class="data-grid four"><article><span>Rating</span><b class="${dc.analystRating === 'Strong Buy' ? 'good' : dc.analystRating === 'Buy' ? 'good' : dc.analystRating === 'Hold' ? 'warn' : ''}">${esc(dc.analystRating || '—')}</b></article><article><span>Mean target</span><b>${dc.analystTargetMean != null ? price(dc.analystTargetMean) : '—'}</b></article><article><span>Upside to mean</span><b class="${upside != null ? (upside >= 0 ? 'good' : 'bad') : ''}">${upside != null ? `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%` : '—'}</b></article><article><span>Target range</span><b>${dc.analystTargetLow != null ? `${price(dc.analystTargetLow)} – ${price(dc.analystTargetHigh)}` : '—'}</b></article></div>${dc.analystNote ? `<p class="bodyline label">${esc(dc.analystNote)}</p>` : ''}</section>`;
}

function riskBudgetPanel(h) {
  const signal = h.computedSignal || h.signal || 'Review';
  const speculative = /lever|speculative|tactical|crypto|option/i.test(`${h.exposureBucket || ''} ${h.role || ''} ${h.thesis || ''}`);
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">Risk budget</p><h2>Portfolio constraint check</h2></div></div><div class="split"><article class="panel"><h3>Current position</h3><div class="smallgrid"><p><b>Weight</b><br>${fmt(h.portfolioWeightPct)}%</p><p><b>Signal</b><br><span class="${signalTone(signal)}">${esc(signal)}</span></p><p><b>Speculative / levered cap</b><br>5%</p><p><b>Single non-index cap</b><br>15%</p></div></article><article class="panel"><h3>Interpretation</h3><p>${speculative ? 'This holding is treated as speculative/levered for risk-budget purposes. Size discipline matters more than thesis confidence.' : 'This holding is reviewed against the single-position concentration budget and its role in the broader portfolio.'}</p><p class="bodyline"><b>Action implication:</b> if signal escalates to TRIM WATCH or EXIT REVIEW, portfolio weight and volatility contribution should be checked before adding exposure.</p></article></div></section>`;
}

const css = `:root{--bg:#f3f2ed;--paper:#fbfaf6;--paper2:#eeede7;--ink:#24231f;--muted:#747168;--rule:#dedbd2;--rule2:#ebe8df;--green:#2f6f4e;--red:#9f3f35;--blue:#405f9f;--warn:#8a6a2c}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}a{color:inherit}.page{max-width:none;margin:0;padding:0}.top{position:sticky;top:0;z-index:30;display:grid;grid-template-columns:1fr auto 1fr;gap:18px;align-items:center;padding:17px clamp(18px,4vw,56px);border-bottom:1px solid var(--rule);background:rgba(243,242,237,.9);backdrop-filter:blur(18px);font-size:14px}.top a{text-decoration:none;color:rgba(36,35,31,.82)}.top a:hover{text-decoration:underline;text-underline-offset:4px}.top span{text-align:right;color:var(--muted);font-size:13px}.brand{font-weight:600;letter-spacing:-.02em}.hero{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:clamp(24px,5vw,80px);align-items:end;min-height:460px;padding:78px clamp(18px,4vw,56px) 48px;border-bottom:1px solid var(--rule);background:linear-gradient(180deg,var(--bg),#f0eee8)}.eyebrow,.label{font-size:14px;line-height:1.35;color:var(--muted);margin:0 0 22px;font-weight:500}.kicker{font-size:14px;color:var(--muted);margin:0 0 24px}h1{font-size:clamp(72px,13vw,176px);line-height:.86;letter-spacing:-.085em;margin:0;font-weight:500;color:rgba(36,35,31,.94)}h2{font-size:clamp(34px,4.2vw,72px);line-height:.96;letter-spacing:-.055em;font-weight:500;margin:0;color:rgba(36,35,31,.94)}h3{font-size:16px;line-height:1.2;margin:0 0 8px;font-weight:600}p{color:rgba(36,35,31,.88);line-height:1.55;margin:0}.lede{font-size:clamp(20px,2.2vw,31px);line-height:1.22;letter-spacing:-.032em;max-width:980px;margin-top:26px}.status{border:1px solid var(--rule);background:#ffffff;padding:20px;min-height:240px;display:flex;flex-direction:column;justify-content:space-between}.status span{display:block;color:var(--muted);font-size:14px}.status strong{display:block;font-size:clamp(34px,4vw,58px);line-height:.95;letter-spacing:-.055em;font-weight:500}.notice{border-top:1px solid var(--rule);margin-top:34px;padding-top:16px;color:var(--muted);max-width:800px}.section{padding:56px clamp(18px,4vw,56px);border-bottom:1px solid var(--rule)}.section-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:30px}.grid{display:grid;gap:0}.metrics{grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--rule)}.metric,.data-grid article,.panel{background:#ffffff;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:22px;min-width:0}.metric:last-child{border-right:0}.metric span,.data-grid span{display:block;color:var(--muted);font-size:14px}.metric strong,.data-grid b{display:block;font-size:clamp(24px,2.5vw,42px);font-weight:500;letter-spacing:-.05em;line-height:.98;margin-top:14px;overflow-wrap:anywhere}.data-grid{display:grid;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.data-grid.six{grid-template-columns:repeat(6,minmax(0,1fr))}.data-grid.four{grid-template-columns:repeat(4,minmax(0,1fr))}.action-grid b{font-size:clamp(22px,2.1vw,34px)}.good{color:var(--green)!important}.bad{color:var(--red)!important}.warn{color:var(--warn)!important}.bodyline{margin-top:18px;max-width:980px}.split{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.panel{border-left:0;border-top:0}.smallgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.smallgrid p{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px}.force{border-top:1px solid var(--rule);padding:16px 0}.force b{font-weight:600}.chart-section{background:#ffffff}.tv-wrap{height:640px;border:1px solid var(--rule);background:#fbfaf6;overflow:hidden}.tvchart{height:100%;width:100%}.tv-placeholder{height:100%;display:grid;place-items:center;text-align:center;padding:28px;background:#ffffff)}.tv-placeholder p{max-width:560px;margin:10px auto 0}.load-tv{margin-top:18px;border:1px solid rgba(36,35,31,.72);border-radius:999px;background:transparent;color:var(--ink);padding:12px 16px;cursor:pointer;font-weight:600}.load-tv:hover{background:rgba(36,35,31,.88);color:var(--bg)}.fallback-chart{margin-top:14px;color:var(--muted)}.fallback-chart summary{cursor:pointer;color:rgba(36,35,31,.9);font-size:14px}.realchart{display:block;width:100%;max-height:560px;object-fit:contain;border:1px solid var(--rule);background:var(--paper);margin-top:14px}.ticker-nav{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.ticker-nav a{padding:14px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);text-decoration:none;background:#ffffff}.ticker-nav a.active{background:rgba(36,35,31,.08)}.ticker-nav b{display:block;font-size:22px;letter-spacing:-.04em}.ticker-nav span{display:block;color:var(--muted);font-size:12px;margin-top:4px}.quality{display:inline-block;margin-top:12px;border:1px solid var(--rule);border-radius:999px;padding:5px 8px;color:var(--muted);font-style:normal;font-size:12px}.quality.medium,.quality.available{color:var(--green)}.quality.low{color:var(--warn)}.quality.missing{color:var(--red)}.balloon-bar-wrap{margin-bottom:28px}.balloon-bar{display:flex;height:52px;border:1px solid var(--rule);overflow:hidden;border-radius:4px}.balloon-seg{display:flex;align-items:center;overflow:hidden;transition:width .3s}.balloon-seg span{padding:0 12px;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.balloon-seg.substance{background:rgba(47,111,78,.18);color:var(--green);border-right:2px solid rgba(47,111,78,.4)}.balloon-seg.hope{background:rgba(138,106,44,.13);color:var(--warn)}.balloon-labels{display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--muted)}.balloon-label-floor{text-align:center;color:var(--green);font-weight:600}.footer{color:var(--muted);font-size:13px;padding:22px clamp(18px,4vw,56px);border-top:1px solid var(--rule)}@media(max-width:1100px){.top{grid-template-columns:1fr}.top span{text-align:left}.hero,.metrics,.split,.data-grid.six,.data-grid.four{grid-template-columns:1fr}.metric,.data-grid article,.panel{border-right:0}.hero{min-height:auto;padding-top:64px}.tv-wrap{height:520px}}@media(max-width:640px){.section,.hero{padding-left:16px;padding-right:16px}h1{font-size:64px}.lede{font-size:18px}.tv-wrap{height:420px}}`;

const lazyTvScript = `<script>(function(){var loading=false,loaded=false;function loadScript(cb){if(loaded)return cb();if(loading){return setTimeout(function(){loadScript(cb)},120)}loading=true;var s=document.createElement('script');s.src='https://s3.tradingview.com/tv.js';s.async=true;s.onload=function(){loaded=true;cb()};s.onerror=function(){alert('TradingView script failed to load. Try again later.')};document.head.appendChild(s)}function mount(wrap){var containerId=wrap.dataset.tvContainer;var symbol=wrap.dataset.tvSymbol;var placeholder=wrap.querySelector('.tv-placeholder');var chart=wrap.querySelector('.tvchart');if(wrap.dataset.loaded==='true')return;placeholder.innerHTML='<span class="label">Loading live market chart…</span><p>Fetching TradingView widget for '+symbol+'.</p>';loadScript(function(){if(!window.TradingView){placeholder.innerHTML='<span class="label">Chart failed</span><p>TradingView unavailable.</p>';return}chart.hidden=false;placeholder.style.display='none';wrap.dataset.loaded='true';new TradingView.widget({autosize:true,symbol:symbol,interval:'D',timezone:'America/New_York',theme:'light',style:'1',locale:'en',enable_publishing:false,allow_symbol_change:true,withdateranges:true,hide_side_toolbar:false,details:true,hotlist:false,calendar:false,studies:['Volume@tv-basicstudies','MASimple@tv-basicstudies','RSI@tv-basicstudies','MACD@tv-basicstudies'],container_id:containerId})})}document.addEventListener('click',function(e){var btn=e.target.closest('.load-tv');if(!btn)return;var wrap=btn.closest('.tv-wrap');if(wrap)mount(wrap)});})();</script>`;

function pageFor(h) {
  const rule = strategyFor(h.ticker);
  const levels = numericLevels(h.ticker, h.livePrice, h.finviz?.parsed);
  const affected = list(state.strategy?.marketForces).filter(f => list(f.affected).includes(h.ticker));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(h.ticker)} · Ticker Workspace</title><style>${css}</style></head><body><main class="page"><div class="top"><a href="/">← Capital Radar</a><div class="brand">${esc(h.ticker)} workspace</div><span>${esc(state.meta?.reportDate || '')} · rating + live chart</span></div><header class="hero"><section><p class="kicker">Ticker workspace · decision first</p><h1>${esc(h.ticker)}</h1><p class="lede">${esc(h.role || h.exposureBucket || 'Holding')} · ${esc(rule.posture)}. This page unifies rating, action bands, thesis, risk invalidation, and real market chart in one readable sequence.</p><p class="notice"><b>Visual rule:</b> data first, reaction second, chart on demand. No synthetic candles are used.</p></section><aside class="status"><span>Current price</span><strong>${price(h.livePrice)}</strong><span>Signal: <b class="${signalTone(h.computedSignal || h.signal)}">${esc(h.computedSignal || h.signal || 'Review')}</b></span><span>Total return: <b class="${tone(h.totalReturnUsd)}">${money(h.totalReturnUsd)} / ${pct(h.totalReturnPct)}</b></span>${Number.isFinite(h.unrealizedGain) ? `<span>Unrealized P&amp;L: <b class="${tone(h.unrealizedGain)}">${money(h.unrealizedGain)} / ${pct(h.unrealizedPct)}</b></span><span>Avg cost: <b>${price(h.avgCostPrice)}</b></span>` : ''}</aside></header><section class="grid metrics"><article class="metric"><span>Market value</span><strong>$${fmt(h.marketValue)}</strong></article><article class="metric"><span>Portfolio weight</span><strong>${fmt(h.portfolioWeightPct)}%</strong></article><article class="metric"><span>Day / 1M</span><strong><span class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</span> / <span class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</span></strong></article><article class="metric"><span>Operating horizon</span><strong>${esc(levels.horizon)}</strong></article>${Number.isFinite(h.unrealizedGain) ? `<article class="metric"><span>Unrealized P&amp;L</span><strong class="${tone(h.unrealizedGain)}">${money(h.unrealizedGain)}</strong></article><article class="metric"><span>P&amp;L %</span><strong class="${tone(h.unrealizedPct)}">${pct(h.unrealizedPct)}</strong></article>` : ''}${h.avgCostPrice != null ? `<article class="metric"><span>Avg cost / share</span><strong>${price(h.avgCostPrice)}</strong></article>` : ''}</section>${portfolioNav(h.ticker)}${fundamentalFloorPanel(h)}${companyFundamentalsPanel(h)}${analystConsensusPanel(h)}${dataQualityPanel(h)}${riskBudgetPanel(h)}<section class="section"><div class="section-head"><div><p class="eyebrow">Action bands</p><h2>Numbers to act around</h2></div></div>${actionBandHtml(levels)}<p class="bodyline">Basis: ${esc(levels.basis)}. These are operating bands, not permanent truths; update as market structure changes.</p></section><section class="section"><div class="section-head"><div><p class="eyebrow">Thesis / invalidation</p><h2>What must remain true</h2></div></div><div class="split"><article class="panel"><h3>Thesis</h3><p>${esc(h.thesis || h.actionRationale || 'No thesis loaded.')}</p><p class="bodyline"><b>Watch:</b> ${esc(h.watch || 'No watch item loaded.')}</p></article><article class="panel"><h3>Rule text</h3><div class="smallgrid"><p><b>Hold:</b><br>${esc(rule.holdUntil)}</p><p><b>Add:</b><br>${esc(rule.addWhen)}</p><p><b>Trim:</b><br>${esc(rule.trimWhen)}</p><p><b>Exit:</b><br>${esc(rule.exitWhen)}</p></div></article></div></section><section class="section chart-section"><div class="section-head"><div><p class="eyebrow">Chart</p><h2>Live market chart</h2></div></div>${tradingViewChart(h)}<p class="bodyline label">Primary chart source: TradingView market-data widget for ${esc(tvSymbol(h.ticker))}. Loaded on demand for speed.</p></section>${flowPanel(h)}<section class="section"><div class="section-head"><div><p class="eyebrow">Context</p><h2>Forces / evidence</h2></div></div>${affected.map(f => `<div class="force"><b>${esc(f.name)} · ${esc(f.direction)}</b><p>${esc(f.interpretation)}</p><p class="label">${esc(list(f.evidence).join(' · '))}</p></div>`).join('') || '<p>No active market force mapped.</p>'}</section><footer class="footer">Generated from ${esc(path.relative(root, statePath))}. Research support only; no automatic brokerage action.</footer></main>${lazyTvScript}</body></html>`;
}

for (const h of holdings) {
  fs.writeFileSync(path.join(outDir, `${String(h.ticker).toLowerCase()}.html`), pageFor(h));
}
console.log(`generated ${holdings.length} enhanced editorial ticker workspaces`);