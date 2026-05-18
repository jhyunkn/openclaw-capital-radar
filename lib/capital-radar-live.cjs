const fs = require('fs');
const path = require('path');

const defaultHoldingsPath = path.join(__dirname, '..', 'data', 'report-state.sample.json');
const fredSeries = {
  DGS2: 'US 2Y Treasury yield',
  DGS10: 'US 10Y Treasury yield',
  DGS30: 'US 30Y Treasury yield',
  T10YIE: '10Y breakeven inflation rate',
  BAMLH0A0HYM2: 'High yield option-adjusted spread',
  BAMLC0A0CM: 'Investment grade corporate OAS',
  DFF: 'Effective federal funds rate'
};

const secCandidateSymbols = ['MSFT','AMZN','CEG','META','MA','NFLX','TSLA','COIN','NVDA','AVGO','VRT','GOOGL'];

const globalReportSources = [
  { institution: 'Federal Reserve / FRED', geography: 'US', use: 'Rates, inflation, growth, labor, liquidity release metadata', status: 'active-public-csv' },
  { institution: 'BIS', geography: 'Global', use: 'Global liquidity, credit, cross-border banking, financial stability plumbing', status: 'roadmap' },
  { institution: 'IMF', geography: 'Global', use: 'Country macro, policy, fiscal/external risk context', status: 'roadmap' },
  { institution: 'World Bank', geography: 'Global', use: 'Growth outlooks, regional risk framing, development/macro reports', status: 'roadmap' },
  { institution: 'US Treasury Fiscal Data', geography: 'US', use: 'Debt, deficit, fiscal flows, interest expense', status: 'roadmap' },
  { institution: 'JPMorgan / BlackRock / Vanguard public outlooks', geography: 'Global markets', use: 'Capital market assumptions, asset allocation regimes, chartbook framing', status: 'manual-ingestion-roadmap' },
  { institution: 'SEC / company filings', geography: 'US equities', use: 'Company fundamentals, risk factors, filings, earnings evidence', status: 'next-adapter' }
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function round(n, digits = 2) { return typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(digits)) : null; }
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'OpenClaw Capital Radar research prototype; contact: capital-radar-local' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function secTickerMap() {
  const url = 'https://www.sec.gov/files/company_tickers.json';
  const json = await fetchJson(url);
  const map = {};
  for (const row of Object.values(json || {})) {
    if (row?.ticker && row?.cik_str) map[String(row.ticker).toUpperCase()] = String(row.cik_str).padStart(10, '0');
  }
  return map;
}

async function secSubmission(symbol, cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const json = await fetchJson(url);
  const recent = json.filings?.recent || {};
  const forms = recent.form || [];
  const accession = recent.accessionNumber || [];
  const filingDate = recent.filingDate || [];
  const primaryDocument = recent.primaryDocument || [];
  const filings = [];
  for (let i = 0; i < forms.length && filings.length < 8; i++) {
    if (!['10-K','10-Q','8-K','20-F'].includes(forms[i])) continue;
    const acc = String(accession[i] || '').replace(/-/g, '');
    filings.push({
      form: forms[i],
      filingDate: filingDate[i] || null,
      document: primaryDocument[i] || null,
      sourceUrl: acc && primaryDocument[i] ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${primaryDocument[i]}` : url
    });
  }
  return {
    symbol,
    cik,
    entityName: json.name || null,
    sic: json.sic || null,
    sicDescription: json.sicDescription || null,
    fiscalYearEnd: json.fiscalYearEnd || null,
    source: 'SEC submissions JSON public endpoint',
    sourceUrl: url,
    recentMaterialFilings: filings
  };
}

async function fetchSecFilings(symbols) {
  const out = [], errors = [];
  let map;
  try { map = await secTickerMap(); } catch (e) { return { filings: out, errors: [{ source: 'SEC company_tickers', error: e.message }] }; }
  for (const symbol of symbols) {
    const clean = String(symbol).toUpperCase().replace(/[^A-Z]/g, '');
    const cik = map[clean];
    if (!cik) continue;
    try { out.push(await secSubmission(clean, cik)); }
    catch (e) { errors.push({ symbol: clean, source: 'SEC submissions', error: e.message }); }
  }
  return { filings: out, errors };
}

async function yahooChart(symbol) {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=6mo&interval=1d&includePrePost=false&events=div%2Csplits`;
  const json = await fetchJson(url);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo chart result for ${symbol}`);
  const quote = result.indicators?.quote?.[0] || {};
  const closes = (quote.close || []).filter(v => typeof v === 'number');
  const timestamps = result.timestamp || [];
  const meta = result.meta || {};
  const price = meta.regularMarketPrice ?? closes.at(-1) ?? null;
  const prevClose = closes.length > 1 ? closes.at(-2) : meta.chartPreviousClose ?? null;
  const at = idx => closes.length > Math.abs(idx) ? closes.at(idx) : closes[0];
  const calc = base => price && base ? ((price / base) - 1) * 100 : null;
  return {
    symbol,
    source: 'Yahoo Finance chart API (public/unofficial)',
    sourceUrl: url,
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    currency: meta.currency || null,
    exchange: meta.exchangeName || meta.fullExchangeName || null,
    price: round(price),
    previousClose: round(prevClose),
    changePct: round(calc(prevClose)),
    perf5dPct: round(calc(at(-6))),
    perf1mPct: round(calc(at(-22))),
    perf3mPct: round(calc(at(-66))),
    sparkline: closes.slice(-60).map(v => round(v)),
    dataPoints: closes.length,
    lastTimestamp: timestamps.at(-1) ? new Date(timestamps.at(-1) * 1000).toISOString() : null
  };
}

function parseFredCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).slice(1);
  for (let i = lines.length - 1; i >= 0; i--) {
    const [date, raw] = lines[i].split(',');
    const value = Number(raw);
    if (date && Number.isFinite(value)) return { date, value };
  }
  return null;
}
async function fredLatest(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'OpenClaw Capital Radar research prototype' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const latest = parseFredCsv(await res.text());
  return { id, name: fredSeries[id], source: 'FRED CSV public endpoint', sourceUrl: url, latestDate: latest?.date || null, value: latest ? round(latest.value, 3) : null };
}

function scoreHolding(h) {
  let score = 70;
  const breakdown = [{ label: 'Base score', impact: 70, note: 'Neutral starting point before role, trend, concentration, and risk adjustments.' }];
  const role = (h.role || '').toLowerCase();
  const add = (impact, label, note) => { score += impact; breakdown.push({ label, impact, note }); };
  if (role.includes('core') || role.includes('quality') || role.includes('anchor')) add(8, 'Role quality', 'Core / quality / anchor roles get a durability credit.');
  if (role.includes('levered') || role.includes('decay')) add(-18, 'Levered decay risk', 'Levered or path-dependent products receive a structural risk penalty.');
  if (role.includes('speculative') || h.health === 'Unknown') add(-16, 'Thesis uncertainty', 'Speculative or unknown-health positions need more evidence before confidence rises.');
  if ((h.perf1mPct ?? 0) > 8) add(5, '1M momentum', 'Recent one-month price action is constructive.');
  if ((h.perf1mPct ?? 0) < -8) add(-6, '1M drawdown', 'One-month weakness pressures the rating.');
  if ((h.perf5dPct ?? 0) < -8) add(-4, '5D stress', 'Sharp five-day weakness triggers short-term review.');
  if ((h.portfolioWeightPct ?? 0) > 35 && h.ticker !== 'SPY') add(-8, 'Concentration risk', 'Large non-index position weight increases portfolio risk.');
  score = Math.max(0, Math.min(100, Math.round(score)));
  let signal = h.signal;
  if (score >= 85 && !['TRIM WATCH','EXIT REVIEW','INVESTIGATE'].includes(signal)) signal = 'HOLD';
  else if (score >= 70 && signal === 'HOLD') signal = 'HOLD';
  else if (score >= 55 && signal === 'HOLD') signal = 'HOLD / WATCH';
  else if (score < 40 && role.includes('levered')) signal = 'EXIT REVIEW';
  else if (score < 55 && !['EXIT REVIEW','INVESTIGATE'].includes(signal)) signal = 'TRIM WATCH';
  return { score, signal, breakdown };
}

function classifyRegime(live) {
  const by = Object.fromEntries(live.marketTape.map(x => [x.symbol, x]));
  const spy = by.SPY, qqq = by.QQQ, vix = by['^VIX'];
  const dgs10 = live.ratesCredit.find(x => x.id === 'DGS10');
  const dgs2 = live.ratesCredit.find(x => x.id === 'DGS2');
  const hy = live.ratesCredit.find(x => x.id === 'BAMLH0A0HYM2');
  const curve = dgs10?.value != null && dgs2?.value != null ? dgs10.value - dgs2.value : null;
  const riskOn = (spy?.perf5dPct ?? 0) > 0 && (qqq?.perf5dPct ?? 0) > 0;
  const vol = vix?.price ?? null;
  const pressure = (dgs10?.value ?? 0) > 4.25 ? 'rate pressure present' : 'rate pressure contained';
  return {
    posture: riskOn && (!vol || vol < 20) ? 'HOLD' : 'HOLD / WATCH',
    riskLevel: vol == null ? 'Unknown' : vol < 16 ? 'Low/normal' : vol < 22 ? 'Moderate' : 'High',
    growth: 'Live proxy: equity trend ' + (riskOn ? 'constructive' : 'mixed/weak'),
    inflation: 'Live proxy: breakeven/rates check required; see FRED T10YIE',
    policy: dgs10?.value ? `Live: 10Y Treasury ${dgs10.value}% (${pressure})` : 'Live rates unavailable',
    liquidity: hy?.value ? `Live: HY OAS ${hy.value}` : 'Credit spread unavailable',
    riskAppetite: vol ? `Live: VIX ${vol}; ${riskOn ? 'selective risk-on' : 'risk watch'}` : 'VIX unavailable',
    mostImportantMacroSignal: curve != null ? `2Y/10Y curve is ${curve.toFixed(2)} pts; watch rate pressure and cycle signal.` : 'Rates curve unavailable.',
    confidence: 'Medium for prices/rates; low for fundamentals/news until adapters are added.',
    evidence: ['Yahoo chart endpoint for prices', 'FRED CSV endpoint for Treasury/rates/credit indicators']
  };
}

function exposureBucket(h) {
  const role = (h.role || '').toLowerCase();
  if (role.includes('levered')) return 'Levered / decay product';
  if (role.includes('speculative')) return 'Speculative / thesis verification';
  if (h.ticker === 'SPY') return 'Index anchor';
  if (role.includes('ai') || role.includes('cloud') || role.includes('power')) return 'AI / infrastructure compounder';
  if (role.includes('quality') || role.includes('core')) return 'Core compounder';
  return 'Other exposure';
}

function attachPrices(state, live) {
  const bySymbol = Object.fromEntries(live.marketTape.map(x => [x.symbol, x]));
  const priced = state.holdings.map(h => {
    const quote = bySymbol[h.ticker];
    const marketValue = quote?.price != null ? quote.price * h.shares : null;
    const enriched = { ...h, livePrice: quote?.price ?? null, priceAsOf: quote?.asOf ?? null, dayChangePct: quote?.changePct ?? null, perf5dPct: quote?.perf5dPct ?? null, perf1mPct: quote?.perf1mPct ?? null, perf3mPct: quote?.perf3mPct ?? null, sparkline: quote?.sparkline ?? [], marketValue: marketValue != null ? round(marketValue, 2) : null, liveDataSource: quote?.source ?? 'unavailable', exposureBucket: exposureBucket(h) };
    return enriched;
  });
  const total = priced.reduce((sum, h) => sum + (h.marketValue || 0), 0);
  return priced.map(h => {
    const withWeight = { ...h, portfolioWeightPct: total && h.marketValue ? round((h.marketValue / total) * 100, 2) : null };
    const rating = scoreHolding(withWeight);
    return { ...withWeight, healthScore: rating.score, computedSignal: rating.signal, ratingBreakdown: rating.breakdown, analysisChart: buildAnalysisChartModel({ ...withWeight, computedSignal: rating.signal }) };
  });
}

function buildAnalysisChartModel(h) {
  const price = Number(h.livePrice || 0);
  if (!price) return { status: 'unavailable', caveat: 'No live price available.' };
  const role = (h.exposureBucket || h.role || '').toLowerCase();
  const isLevered = role.includes('levered') || ['CONL','TSLT'].includes(String(h.ticker).toUpperCase());
  const isSpec = role.includes('speculative') || ['BMNR','TSNF'].includes(String(h.ticker).toUpperCase());
  const profile = isLevered ? 'tactical_risk' : isSpec ? 'speculative_verification' : 'core_or_quality';
  const pctBand = profile === 'tactical_risk'
    ? { buyLow: -0.09, buyHigh: -0.03, trimLow: 0.08, trimHigh: 0.18, stop: -0.10, hardExit: -0.15 }
    : profile === 'speculative_verification'
      ? { buyLow: -0.12, buyHigh: -0.06, trimLow: 0.08, trimHigh: 0.15, stop: -0.10, hardExit: -0.16 }
      : { buyLow: -0.10, buyHigh: -0.04, trimLow: 0.12, trimHigh: 0.20, stop: -0.14, hardExit: -0.18 };
  const level = p => round(price * (1 + p), price < 10 ? 3 : 2);
  const signal = h.computedSignal || h.signal || 'HOLD / WATCH';
  const bias = signal.includes('EXIT') ? 'risk_reduction' : signal.includes('TRIM') ? 'protect_capital' : signal.includes('INVESTIGATE') ? 'freeze_until_verified' : signal.includes('ADD') ? 'prepare_entry' : 'hold_with_triggers';
  return {
    status: 'active',
    profile,
    bias,
    current: round(price, price < 10 ? 3 : 2),
    zones: {
      buy: { low: level(pctBand.buyLow), high: level(pctBand.buyHigh), label: 'value / entry zone' },
      trim: { low: level(pctBand.trimLow), high: level(pctBand.trimHigh), label: 'trim / protect zone' },
      stop: { value: level(pctBand.stop), label: 'stop / review' },
      hardExit: { value: level(pctBand.hardExit), label: 'hard exit review' }
    },
    narrative: signal.includes('INVESTIGATE') ? 'Chart can guide timing, but action is frozen until thesis/liquidity/downside are verified.' : signal.includes('EXIT') || signal.includes('TRIM') ? 'Use strength to reduce fragility; do not average down below invalidation.' : 'Hold unless price enters a prepared zone or thesis evidence changes.',
    caveat: 'Public-data dynamic zone; refine with cost basis, ATR/options/fundamentals as adapters improve.'
  };
}

function buildMarketForces(state, live) {
  const by = Object.fromEntries(live.marketTape.map(x => [x.symbol, x]));
  const rate10 = live.ratesCredit.find(x => x.id === 'DGS10');
  const hy = live.ratesCredit.find(x => x.id === 'BAMLH0A0HYM2');
  const breakeven = live.ratesCredit.find(x => x.id === 'T10YIE');
  const force = (name, direction, intensity, affected, interpretation, evidence) => ({ name, direction, intensity, affected, interpretation, evidence });
  return [
    force('Rates pressure', (rate10?.value ?? 0) > 4.25 ? 'rising / restrictive' : 'contained', Math.min(5, Math.max(1, Math.round((rate10?.value ?? 3) - 1))), ['MSFT','AMZN','META','NFLX','CEG','SPY'], 'Higher long-end rates pressure long-duration growth multiples and make valuation discipline more important.', [`DGS10 ${rate10?.value ?? 'n/a'} as of ${rate10?.latestDate ?? 'n/a'}`]),
    force('Risk appetite', (by.SPY?.perf5dPct ?? 0) > 0 && (by.QQQ?.perf5dPct ?? 0) > 0 ? 'selective risk-on' : 'mixed / risk watch', Math.min(5, Math.max(1, Math.round(Math.abs(by.QQQ?.perf5dPct ?? 1)))), ['SPY','QQQ','IWM','CONL','TSLT'], 'Index and volatility behavior sets the risk budget for speculative and levered exposure.', [`SPY 5D ${by.SPY?.perf5dPct ?? 'n/a'}%`, `QQQ 5D ${by.QQQ?.perf5dPct ?? 'n/a'}%`, `VIX ${by['^VIX']?.price ?? 'n/a'}`]),
    force('AI infrastructure', (by.CEG?.perf1mPct ?? 0) > 0 ? 'hot / crowded' : 'cooling', Math.min(5, Math.max(1, Math.round(Math.abs(by.CEG?.perf1mPct ?? 1) / 5))), ['MSFT','AMZN','META','CEG'], 'AI capex, cloud demand, power scarcity, and data-center buildout remain a portfolio force but need crowding checks.', [`CEG 1M ${by.CEG?.perf1mPct ?? 'n/a'}%`, `MSFT 1M ${by.MSFT?.perf1mPct ?? 'n/a'}%`, `AMZN 1M ${by.AMZN?.perf1mPct ?? 'n/a'}%`]),
    force('Crypto liquidity beta', (by['BTC-USD']?.perf1mPct ?? 0) > 0 ? 'expanding' : 'contracting', Math.min(5, Math.max(1, Math.round(Math.abs(by['BTC-USD']?.perf1mPct ?? 1) / 6))), ['CONL','COIN','BTC-USD','ETH-USD'], 'Crypto beta can amplify upside but is highly liquidity-sensitive and path-dependent through levered products.', [`BTC 1M ${by['BTC-USD']?.perf1mPct ?? 'n/a'}%`, `COIN 1M ${by.COIN?.perf1mPct ?? 'n/a'}%`]),
    force('Credit conditions', (hy?.value ?? 3) > 4 ? 'stress rising' : 'benign / watch', Math.min(5, Math.max(1, Math.round(hy?.value ?? 2))), ['SPY','IWM','CONL','TSLT'], 'Credit spreads are a plumbing check: if they widen while equities rise, risk appetite may be less durable.', [`HY OAS ${hy?.value ?? 'n/a'} as of ${hy?.latestDate ?? 'n/a'}`]),
    force('Inflation expectation', (breakeven?.value ?? 2.3) > 2.5 ? 're-accelerating watch' : 'contained watch', Math.min(5, Math.max(1, Math.round((breakeven?.value ?? 2) * 1.5))), ['SPY','MA','AMZN','NFLX'], 'Inflation expectations influence rates, consumer pressure, and valuation multiples.', [`T10YIE ${breakeven?.value ?? 'n/a'} as of ${breakeven?.latestDate ?? 'n/a'}`])
  ];
}

function buildOpportunityScout(state, live) {
  const by = Object.fromEntries(live.marketTape.map(x => [x.symbol, x]));
  const rate10 = live.ratesCredit.find(x => x.id === 'DGS10');
  const breakeven = live.ratesCredit.find(x => x.id === 'T10YIE');
  const hy = live.ratesCredit.find(x => x.id === 'BAMLH0A0HYM2');
  const quoteEvidence = ticker => {
    const q = by[ticker];
    if (!q) return ['Live quote unavailable; keep as research-only until price adapter succeeds.'];
    return [
      `Price $${q.price ?? 'n/a'}; day ${q.changePct ?? 'n/a'}%; 1M ${q.perf1mPct ?? 'n/a'}%; 3M ${q.perf3mPct ?? 'n/a'}%`,
      `Source: ${q.source}; as of ${q.asOf || 'n/a'}`
    ];
  };
  const macroEvidence = [
    rate10 ? `10Y Treasury ${rate10.value}% as of ${rate10.latestDate}` : '10Y Treasury unavailable',
    breakeven ? `10Y breakeven inflation ${breakeven.value}% as of ${breakeven.latestDate}` : 'Breakeven inflation unavailable',
    hy ? `HY OAS ${hy.value} as of ${hy.latestDate}` : 'HY OAS unavailable'
  ];
  const ideas = [
    {
      ticker: 'NVDA',
      name: 'NVIDIA',
      theme: 'AI compute leader',
      candidateType: 'single-name equity',
      thesis: 'Direct exposure to AI accelerator demand; useful benchmark for whether the portfolio should own the center of the AI capex stack instead of only cloud/platform beneficiaries.',
      whyNow: 'AI infrastructure remains an active force in the current report; candidate should be watched for pullbacks or earnings-confirmed demand durability.',
      dataSupport: [...quoteEvidence('NVDA'), ...macroEvidence],
      confirmBeforeAdd: ['Forward revenue/gross-margin durability remains intact', 'Valuation reset or earnings growth justifies multiple', 'Customer concentration and export-control risks are understood'],
      keyRisks: ['Crowding and multiple compression', 'Export controls / supply chain limits', 'AI capex digestion cycle'],
      score: 82,
      signal: 'ADD WATCH'
    },
    {
      ticker: 'AVGO',
      name: 'Broadcom',
      theme: 'AI networking / custom silicon',
      candidateType: 'single-name equity',
      thesis: 'Picks-and-shovels exposure to AI networking and custom ASIC demand with a more diversified enterprise/software profile than pure GPU exposure.',
      whyNow: 'If AI capex stays strong but mega-cap platform exposure is already high, Broadcom gives a different layer of the same force field.',
      dataSupport: [...quoteEvidence('AVGO'), ...macroEvidence],
      confirmBeforeAdd: ['AI semiconductor growth offsets cyclicality', 'Debt/software integration risk remains controlled', 'Price action is not purely multiple expansion'],
      keyRisks: ['Semiconductor cycle', 'Acquisition/integration execution', 'Valuation crowding'],
      score: 79,
      signal: 'ADD WATCH'
    },
    {
      ticker: 'VRT',
      name: 'Vertiv',
      theme: 'Data-center power and thermal infrastructure',
      candidateType: 'single-name equity',
      thesis: 'Infrastructure-side exposure to AI/data-center buildout: power, cooling, and uptime constraints rather than model/platform winners.',
      whyNow: 'The portfolio already has cloud and power exposure; VRT tests whether physical bottlenecks deserve a dedicated research lane.',
      dataSupport: [...quoteEvidence('VRT'), ...macroEvidence],
      confirmBeforeAdd: ['Backlog/order growth supports the AI infrastructure thesis', 'Margins remain resilient as capacity scales', 'Entry price compensates for crowded theme risk'],
      keyRisks: ['Theme crowding', 'Execution and margin pressure', 'Industrial cyclicality if capex slows'],
      score: 76,
      signal: 'ADD WATCH'
    },
    {
      ticker: 'GOOGL',
      name: 'Alphabet',
      theme: 'Quality compounder / AI platform laggard candidate',
      candidateType: 'single-name equity',
      thesis: 'Potential quality compounder if search/cloud/AI investment remains durable and valuation offers a cleaner margin of safety than hotter AI infrastructure names.',
      whyNow: 'Useful comparison against existing MSFT/AMZN/META exposure before adding more platform concentration.',
      dataSupport: [...quoteEvidence('GOOGL'), ...macroEvidence],
      confirmBeforeAdd: ['Cloud and AI monetization progress is visible', 'Regulatory/search risks are priced in', 'Relative valuation is attractive versus existing platform holdings'],
      keyRisks: ['Antitrust/regulatory pressure', 'Search disruption narrative', 'AI capex margin drag'],
      score: 72,
      signal: 'INVESTIGATE'
    },
    {
      ticker: 'IBIT',
      name: 'iShares Bitcoin Trust',
      theme: 'Cleaner crypto beta replacement',
      candidateType: 'ETF / risk substitution',
      thesis: 'A cleaner vehicle to compare against levered/path-dependent crypto exposure; may reduce decay risk while preserving directional Bitcoin beta.',
      whyNow: 'CONL-style levered decay is already flagged as a risk-control focus; substitute vehicles should be compared before adding or holding levered beta.',
      dataSupport: [...quoteEvidence('IBIT'), ...(by['BTC-USD'] ? [`BTC-USD 1M ${by['BTC-USD'].perf1mPct ?? 'n/a'}%; 3M ${by['BTC-USD'].perf3mPct ?? 'n/a'}%`] : []), ...macroEvidence],
      confirmBeforeAdd: ['Explicit risk budget for crypto beta', 'Liquidity regime supports risk assets', 'Expense, tracking, and drawdown profile beat levered alternatives'],
      keyRisks: ['Bitcoin drawdown risk', 'Liquidity/regulatory shocks', 'No cash flow valuation anchor'],
      score: 66,
      signal: 'INVESTIGATE'
    }
  ];
  return ideas.sort((a,b) => b.score - a.score);
}

function classifyFractalAlignment(item) {
  const trend = (item.perf1mPct ?? 0) > 4 ? 'constructive' : (item.perf1mPct ?? 0) < -6 ? 'weak' : 'mixed';
  const tactical = (item.perf5dPct ?? 0) > 2 ? 'short-term strength' : (item.perf5dPct ?? 0) < -5 ? 'short-term stress' : 'neutral tape';
  const structural = (item.exposureBucket || '').includes('Levered') ? 'structurally fragile' : (item.exposureBucket || '').includes('Speculative') ? 'structural thesis incomplete' : 'structural thesis intact pending filings/news';
  const conflicted = (trend === 'constructive' && structural.includes('fragile')) || (trend === 'weak' && structural.includes('intact'));
  return {
    tacticalLayer: tactical,
    mediumLayer: `${trend} 1M/3M price layer`,
    structuralLayer: structural,
    agreement: conflicted ? 'mixed / conflicted' : trend === 'mixed' ? 'mixed' : 'partially aligned',
    allowedBehavior: item.signal === 'INVESTIGATE' ? 'verify thesis before adding risk' : item.signal === 'EXIT REVIEW' ? 'review/reduce risk only with human judgment' : 'hold/watch; no chase without trigger',
    forbiddenBehavior: item.signal === 'INVESTIGATE' ? 'no add-candidate language without thesis/fundamental proof' : 'do not chase single-layer moves',
    nextTrigger: item.signal === 'EXIT REVIEW' ? 'price breaks invalidation or thesis evidence fails' : 'multi-layer alignment: price zone + thesis confirmation + portfolio fit',
    confidence: item.livePrice ? 'medium price confidence; low fundamentals/news confidence until adapters complete' : 'low'
  };
}

function buildFractalMarketAssessment(state, live) {
  const by = Object.fromEntries(live.marketTape.map(x => [x.symbol, x]));
  const vix = by['^VIX']?.price ?? null;
  const spy = by.SPY, qqq = by.QQQ;
  const regimeNow = vix && vix > 22 ? 'risk-off / stress watch' : ((spy?.perf5dPct ?? 0) > 0 && (qqq?.perf5dPct ?? 0) > 0 ? 'selective risk-on' : 'mixed / transition');
  return {
    status: 'active_public_sources_first_pass',
    regimeNow,
    dominantForces: state.strategy.marketForces.slice(0, 4).map(f => f.name),
    fractalAgreement: regimeNow.includes('mixed') ? 'daily/weekly layers conflict; do not increase risk without stronger confirmation' : 'partial alignment; still require valuation and news confirmation',
    marketValues: {
      broadIndices: ['SPY','QQQ','IWM'].map(symbol => ({ symbol, price: by[symbol]?.price ?? null, oneMonth: by[symbol]?.perf1mPct ?? null, read: (by[symbol]?.perf1mPct ?? 0) > 5 ? 'strength / valuation discipline required' : 'mixed / no broad chase' })),
      volatilityLiquidity: { vix, riskAppetite: state.marketRegime.riskAppetite, credit: state.marketRegime.liquidity, rates: state.marketRegime.policy },
      holdings: state.holdings.map(h => ({ ticker: h.ticker, signal: h.signal, weightPct: h.portfolioWeightPct, livePrice: h.livePrice, ...classifyFractalAlignment(h) }))
    },
    portfolioImplication: 'Preserve core compounders, avoid adding single-layer hype, keep levered/speculative products on explicit risk budget, and prioritize thesis verification for unknown names.',
    nextPostureTrigger: 'Upgrade risk posture only if VIX < 17, credit remains benign, SPY/QQQ breadth confirms, and candidates enter defined value zones with thesis confirmation.',
    sourceCaveat: 'Price/rates/credit/SEC filing metadata are public-source live. News/community/fundamentals estimates remain limited until adapters or providers are added.'
  };
}

function buildPortfolioStory(state) {
  const holdings = state.holdings || [];
  const sumWeight = xs => round(xs.reduce((s, h) => s + (h.portfolioWeightPct || 0), 0));
  const core = holdings.filter(h => ['Index anchor','Core compounder','AI / infrastructure compounder'].includes(h.exposureBucket));
  const tactical = holdings.filter(h => h.exposureBucket === 'Levered / decay product');
  const speculative = holdings.filter(h => h.exposureBucket === 'Speculative / thesis verification');
  const other = holdings.filter(h => !core.includes(h) && !tactical.includes(h) && !speculative.includes(h));
  const buckets = [
    { id: 'core', label: 'Protected core', weightPct: sumWeight(core), tickers: core.map(h => h.ticker), posture: 'compound / hold with defined risk triggers', tone: 'good' },
    { id: 'tactical', label: 'Tactical risk', weightPct: sumWeight(tactical), tickers: tactical.map(h => h.ticker), posture: 'small bucket; trim/exit discipline matters more than thesis loyalty', tone: 'danger' },
    { id: 'speculative', label: 'Unknown thesis', weightPct: sumWeight(speculative), tickers: speculative.map(h => h.ticker), posture: 'freeze adds until filings/liquidity/downside are verified', tone: 'warn' },
    { id: 'other', label: 'Other exposure', weightPct: sumWeight(other), tickers: other.map(h => h.ticker), posture: 'monitor for overlap and opportunity cost', tone: 'blue' }
  ].filter(b => b.weightPct || b.tickers.length);
  const largest = [...holdings].sort((a,b) => (b.portfolioWeightPct || 0) - (a.portfolioWeightPct || 0)).slice(0, 4);
  const riskQueue = [...holdings].sort((a,b) => (a.healthScore || 100) - (b.healthScore || 100)).slice(0, 4);
  const opportunityQueue = (state.strategy?.opportunityScout || []).slice(0, 5).map(o => ({ ticker: o.ticker, signal: o.signal, theme: o.theme, score: o.score }));
  const tacticalWeight = sumWeight(tactical);
  const specWeight = sumWeight(speculative);
  const topFourWeight = sumWeight(largest);
  const primaryRisk = tacticalWeight > 3 ? 'Levered/path-dependent exposure needs tighter risk budget.' : specWeight > 10 ? 'Speculative thesis-verification bucket is meaningful and must be proven.' : topFourWeight > 75 ? 'Concentration is the main risk: top holdings dominate portfolio behavior.' : 'Main risk is regime shift, not single-position exposure.';
  return {
    objective: 'Make profit by minimizing avoidable risk: protect core, keep tactical risk small, verify unknowns, and only add where value zone + thesis + portfolio fit align.',
    currentStory: `${buckets[0]?.label || 'Portfolio'} carries most weight; ${primaryRisk}`,
    buckets,
    largestPositions: largest.map(h => ({ ticker: h.ticker, weightPct: h.portfolioWeightPct, signal: h.computedSignal || h.signal, role: h.exposureBucket })),
    riskQueue: riskQueue.map(h => ({ ticker: h.ticker, healthScore: h.healthScore, signal: h.computedSignal || h.signal, rule: h.analysisChart?.narrative || h.actionRationale })),
    opportunityQueue,
    allowedNow: [
      'Protect profitable/core positions unless thesis or macro regime breaks.',
      'Investigate unclear/speculative holdings before adding capital.',
      'Use prepared zones; do not chase single-day strength.',
      'Treat levered products as short-horizon risk instruments.'
    ],
    forbiddenNow: [
      'No averaging down below invalidation.',
      'No add-candidate upgrade without downside case.',
      'No portfolio-risk increase from one-layer chart excitement.',
      'No paid-data assumption unless source is actually connected.'
    ]
  };
}

function buildStrategyState(state, live) {
  const exposure = {};
  for (const h of state.holdings) exposure[h.exposureBucket] = round((exposure[h.exposureBucket] || 0) + (h.portfolioWeightPct || 0));
  const highestRisk = [...state.holdings].sort((a,b) => (a.healthScore || 0) - (b.healthScore || 0))[0];
  const strongest = [...state.holdings].sort((a,b) => (b.healthScore || 0) - (a.healthScore || 0))[0];
  const marketForces = buildMarketForces(state, live);
  return {
    exposureMap: Object.entries(exposure).map(([bucket, weight]) => ({ bucket, weightPct: weight })).sort((a,b) => b.weightPct - a.weightPct),
    marketForces,
    opportunityScout: buildOpportunityScout(state, live),
    strongestHolding: strongest?.ticker || null,
    weakestHolding: highestRisk?.ticker || null,
    highestRiskPosition: highestRisk?.ticker || null,
    watchTriggers: [
      'If VIX moves above 22, reduce speculative/levered risk review threshold.',
      'If 10Y Treasury continues rising, pressure-test high-duration AI/cloud multiples.',
      'If HY spreads widen materially, treat risk appetite as fragile even if indices stay green.',
      'If AI infrastructure force remains hot while valuation expands, require stronger evidence before adding.',
      'If an opportunity candidate lacks a clear downside case, keep it as research only.'
    ],
    strategyPosture: 'Preserve core compounders, isolate levered/path-dependent risk, scout adds only where valuation, catalyst, and downside clarity align.'
  };
}

async function buildLiveState(options = {}) {
  const basePath = options.basePath || defaultHoldingsPath;
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const symbols = [...new Set([...(base.holdings || []).map(h => h.ticker), 'QQQ', 'IWM', '^VIX', 'DX-Y.NYB', 'BTC-USD', 'ETH-USD', 'TSLA', 'COIN', 'NVDA', 'AVGO', 'VRT', 'GOOGL', 'IBIT'])];
  const marketTape = [], ratesCredit = [], errors = [];
  await Promise.all(symbols.map(async symbol => { try { marketTape.push(await yahooChart(symbol)); } catch (e) { errors.push({ symbol, error: e.message }); } }));
  await Promise.all(Object.keys(fredSeries).map(async id => { try { ratesCredit.push(await fredLatest(id)); } catch (e) { errors.push({ series: id, error: e.message }); } }));
  const sec = await fetchSecFilings([...new Set([...(base.holdings || []).map(h => h.ticker), ...secCandidateSymbols])]);
  errors.push(...sec.errors);
  marketTape.sort((a,b) => symbols.indexOf(a.symbol) - symbols.indexOf(b.symbol));
  ratesCredit.sort((a,b) => Object.keys(fredSeries).indexOf(a.id) - Object.keys(fredSeries).indexOf(b.id));
  const state = JSON.parse(JSON.stringify(base));
  state.meta.reportDate = todayISO();
  state.meta.dataStatus = errors.length ? 'PARTIAL_LIVE_PUBLIC_DATA' : 'LIVE_PUBLIC_DATA';
  state.meta.generatedAt = new Date().toISOString();
  state.meta.liveDataSources = ['Yahoo Finance chart API public/unofficial endpoint', 'FRED public CSV endpoint', 'SEC submissions JSON public endpoint'];
  state.marketRegime = classifyRegime({ marketTape, ratesCredit });
  state.holdings = attachPrices(state, { marketTape, ratesCredit });
  state.strategy = buildStrategyState(state, { marketTape, ratesCredit });
  state.fractalMarketAssessment = buildFractalMarketAssessment(state, { marketTape, ratesCredit });
  state.portfolioStory = buildPortfolioStory(state);
  state.companyFilingEvidence = sec.filings;
  state.globalInstitutionSources = globalReportSources;
  state.liveMarket = marketTape;
  state.liveRatesCredit = ratesCredit;
  state.liveDataErrors = errors;
  state.valuationExpectation.status = 'Partially live: price, market value, weights, recent performance, rates, credit, and SEC filing metadata are active. Forward fundamentals/valuation estimates still need provider or deeper SEC companyfacts adapter.';
  state.finalOutput.strongestCurrentHolding = state.strategy.strongestHolding;
  state.finalOutput.weakestCurrentHolding = state.strategy.weakestHolding;
  state.finalOutput.topAddWatch = state.strategy.opportunityScout.filter(x => x.signal === 'ADD WATCH').map(x => x.ticker).slice(0, 3).join(' / ');
  state.finalOutput.top3NewResearchCandidates = state.strategy.opportunityScout.slice(0, 3).map(x => x.ticker);
  state.finalOutput.finalJudgment = 'Live public market/rates/SEC filing metadata are active. Next layer: SEC companyfacts fundamentals, valuation estimates, news/community ingestion, and alert/state transition automation.';
  return state;
}

module.exports = { buildLiveState };
