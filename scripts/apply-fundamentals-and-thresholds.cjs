const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const fundamentals = JSON.parse(fs.readFileSync(path.join(root, 'data', 'fundamentals.manual.json'), 'utf8'));
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];

// Load XBRL fundamentals (from SEC EDGAR via collect-sec-xbrl-fundamentals.cjs)
const xbrlPath = path.join(root, 'outputs', 'sec-xbrl-fundamentals.json');
const xbrlByTicker = {};
if (fs.existsSync(xbrlPath)) {
  const xbrl = JSON.parse(fs.readFileSync(xbrlPath, 'utf8'));
  for (const row of (xbrl.results || [])) {
    if (row.ticker && row.status === 'ok') xbrlByTicker[String(row.ticker).toUpperCase()] = row;
  }
}
const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
const r = (v,d=2) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
function vol20(h){
  const s = Array.isArray(h.sparkline) ? h.sparkline.map(Number).filter(Number.isFinite) : [];
  if (s.length < 21) return null;
  const tail = s.slice(-21), rets = [];
  for (let i=1;i<tail.length;i++) if (tail[i-1] > 0 && tail[i] > 0) rets.push(Math.log(tail[i]/tail[i-1]));
  if (rets.length < 10) return null;
  const m = rets.reduce((a,b)=>a+b,0)/rets.length;
  const v = rets.reduce((sum,x)=>sum+Math.pow(x-m,2),0)/Math.max(1,rets.length-1);
  return Math.sqrt(v) * Math.sqrt(252) * 100;
}
function kind(t){
  t = String(t||'').toUpperCase();
  if (['TSLT','CONL','TMF','TQQQ','SQQQ','SOXL','SOXS','BITX'].includes(t)) return 'levered';
  if (t === 'BMNR') return 'high_vol_speculative';
  if (['SPY','MSFT','MA'].includes(t)) return 'low_vol_quality';
  return 'standard_equity';
}
function bands(h){
  const ticker = String(h.ticker||'').toUpperCase();
  const price = n(h.livePrice);
  const vol = vol20(h) ?? 35;
  const scale = Math.max(0.75, Math.min(2.75, vol / 35));
  const k = kind(ticker);
  let add = -(1.25 + 1.25 * scale), trim = 8 + 7 * scale, risk = -(6 + 6 * scale);
  if (k === 'levered') { add = -(3 + 2.5 * scale); trim = 12 + 8 * scale; risk = -(12 + 8 * scale); }
  if (k === 'high_vol_speculative') { add = -(3 + 2 * scale); trim = 12 + 7 * scale; risk = -(10 + 8 * scale); }
  if (k === 'low_vol_quality') { add = -(1 + 0.9 * scale); trim = 6 + 4 * scale; risk = -(4 + 3.5 * scale); }
  return { ticker, exposureType:k, realizedVol20Pct:r(vol), addPct:r(add), trimPct:r(trim), riskReviewPct:r(risk), addPrice:price?r(price*(1+add/100)):null, trimPrice:price?r(price*(1+trim/100)):null, riskReviewPrice:price?r(price*(1+risk/100)):null };
}
const thresholds = [];
for (const h of holdings) {
  const ticker = String(h.ticker||'').toUpperCase();
  const f = fundamentals.metrics[ticker];
  h.dataContract = h.dataContract || {};
  if (f) {
    h.dataContract.source = fundamentals.source;
    h.dataContract.asOf = fundamentals.asOf;
    h.dataContract.forwardPE = f.notApplicable ? null : f.forwardPE;
    h.dataContract.fcfYield = f.notApplicable ? null : f.fcfYield;
    h.dataContract.nextEarningsDate = f.notApplicable ? 'N/A' : f.nextEarningsDate;
    h.dataContract.notApplicable = !!f.notApplicable;
    h.dataContract.reason = f.reason || undefined;
    h.dataContract.grossMarginPct = f.grossMarginPct ?? null;
    h.dataContract.grossMarginSource = f.grossMarginSource || null;
    h.dataContract.operatingMarginPct = f.operatingMarginPct ?? null;
    h.dataContract.netMarginPct = f.netMarginPct ?? null;
    h.dataContract.analystRating = f.analystRating || null;
    h.dataContract.analystCount = f.analystCount ?? null;
    h.dataContract.analystTargetMean = f.analystTargetMean ?? null;
    h.dataContract.analystTargetLow = f.analystTargetLow ?? null;
    h.dataContract.analystTargetHigh = f.analystTargetHigh ?? null;
    h.dataContract.analystNote = f.analystNote || null;
    h.dataContract.analystDataAsOf = fundamentals.analystDataAsOf || null;
    h.dataContract.confidence = f.notApplicable ? { forwardPE:'not_applicable', fcfYield:'not_applicable', nextEarningsDate:'not_applicable' } : { forwardPE:f.forwardPE==null?'missing':'seeded_public_fundamental', fcfYield:f.fcfYield==null?'missing':'seeded_public_fundamental', nextEarningsDate:f.nextEarningsDate?'seeded_public_fundamental':'missing' };
  }

  // Merge XBRL financials
  const xbrl = xbrlByTicker[ticker];
  if (xbrl) {
    const xf = xbrl.fundamentals || {};
    h.dataContract.xbrl = {
      source: 'SEC EDGAR XBRL',
      latestFiscalYear: xbrl.latestFiscalYear,
      latestFilingDate: xbrl.latestFilingDate,
      enrichedAt: xbrl.enriched_at,
      revenueTtmM: xf.revenue_ttm_usd_millions ?? null,
      revenuePriorM: xf.revenue_prior_usd_millions ?? null,
      revenueGrowthPct: xf.revenue_growth_pct ?? null,
      netIncomeM: xf.net_income_usd_millions ?? null,
      grossProfitM: xf.gross_profit_usd_millions ?? null,
      epsDiluted: xf.eps_diluted ?? null,
      sharesOutstandingM: xf.shares_outstanding_millions ?? null,
      operatingCfM: xf.operating_cf_usd_millions ?? null,
      capexM: xf.capex_usd_millions ?? null,
      fcfM: xf.fcf_usd_millions ?? null,
      longTermDebtM: xf.long_term_debt_usd_millions ?? null,
      dilutionFlag: xf.dilution_flag || null
    };
    // Compute market cap from live price × shares
    if (h.livePrice && xf.shares_outstanding_millions) {
      h.dataContract.marketCapB = r(h.livePrice * xf.shares_outstanding_millions / 1000, 1);
    }
  }
  const b = bands(h);
  thresholds.push(b);
  h.signalThresholds = { formula:'volatility_adjusted_thresholds_v1 using annualized 20D realized volatility from sparkline log returns; low-vol names get tighter bands, high-vol/levered names get wider bands.', ...b };
}
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
fs.mkdirSync(path.join(root,'outputs'), { recursive:true });
fs.writeFileSync(path.join(root,'outputs','signal-thresholds.json'), JSON.stringify({ generatedAt:new Date().toISOString(), formula:'volatility_adjusted_thresholds_v1', thresholds }, null, 2) + '\n');
console.log(`applied fundamentals and ${thresholds.length} volatility-adjusted threshold sets`);
