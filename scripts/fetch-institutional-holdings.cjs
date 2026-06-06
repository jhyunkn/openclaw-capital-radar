'use strict';

// Fetches 13F institutional holdings from SEC EDGAR for a curated list of
// high-conviction investors. 13F filings are public, free, and required within
// 45 days of quarter end for any manager with $100M+ in equity holdings.
//
// Why this matters: when Druckenmiller, Tepper, or Ackman builds a position,
// that's a signal worth knowing. These managers have research capabilities and
// access we don't — their positioning is publicly available via 13F.
//
// The 45-day lag means this is retrospective (Q1 filings visible by mid-May),
// but it's still a powerful signal for directional confirmation.
//
// Output: outputs/institutional-holdings.json

const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const UA   = 'OpenClaw Capital Radar institutional monitor contact:research@openclaw.io';

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

const universe   = readJson('data/opportunity-universe.json');
const scannerUni = readJson('data/scanner-universe.json');

const convictionTickers = (universe?.tickers || []).map(t => String(t.ticker).toUpperCase());
const scannerTickers    = (scannerUni?.candidates || []).map(c => String(c.ticker).toUpperCase());
const ALL_TICKERS       = new Set([...convictionTickers, ...scannerTickers]);

// ── TRACKED INSTITUTIONS ──────────────────────────────────────────────────────
// High-conviction managers worth tracking. These are known for deep fundamental
// research and large concentrated positions — when they act, it's meaningful.
const TRACKED_MANAGERS = [
  { name: 'Duquesne Family Office (Druckenmiller)', cik: '0001536411', style: 'macro/growth' },
  { name: 'Pershing Square (Ackman)',               cik: '0001336528', style: 'activist/concentrated' },
  { name: 'Appaloosa Management (Tepper)',           cik: '0000931273', style: 'macro/distressed' },
  { name: 'Scion Asset Management (Burry)',          cik: '0001649339', style: 'contrarian/value' },
  { name: 'Third Point (Loeb)',                      cik: '0001418819', style: 'activist/event-driven' },
  { name: 'Tiger Global Management',                 cik: '0001167483', style: 'growth/tech' },
  { name: 'Coatue Management',                       cik: '0001336532', style: 'tech growth' },
  { name: 'Viking Global Investors',                 cik: '0001103804', style: 'fundamental/growth' },
  { name: 'Lone Pine Capital',                       cik: '0001048268', style: 'fundamental/growth' },
  { name: 'D1 Capital Partners',                     cik: '0001766014', style: 'multi-strategy' },
];

// ── EDGAR API HELPERS ─────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// Get most recent 13F filing for a manager
async function getMostRecent13F(cik) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const json = await fetchJson(url);

  const filings = json?.filings?.recent || {};
  const forms   = filings.form          || [];
  const dates   = filings.filingDate    || [];
  const accNums = filings.accessionNumber || [];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === '13F-HR') {
      return {
        filedDate:    dates[i],
        accessionNum: accNums[i],
        // The actual holdings XML is in the filing index
        indexUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F&dateb=&owner=include&count=5`,
        infoTable: accNums[i]
          ? `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/` +
            `${accNums[i].replace(/-/g, '')}/infotable.xml`
          : null,
      };
    }
  }
  return null;
}

// Parse 13F infotable XML to extract holdings
async function parse13FHoldings(infoTableUrl) {
  if (!infoTableUrl) return [];

  try {
    const res = await fetch(infoTableUrl, {
      headers: { 'user-agent': UA, 'accept': '*/*' },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Simple XML parsing — extract infoTable entries
    const holdings = [];
    const entryRegex = /<infoTable>([\s\S]*?)<\/infoTable>/gi;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry  = match[1];
      const get    = tag => {
        const m = entry.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'));
        return m ? m[1].trim() : null;
      };

      const nameOfIssuer = get('nameOfIssuer');
      const cusip        = get('cusip');
      const valueStr     = get('value');
      const sharesStr    = get('sshPrnamt') || get('sshPrnamtType');
      const putCall      = get('putCall');

      if (!nameOfIssuer) continue;

      holdings.push({
        nameOfIssuer: nameOfIssuer.toUpperCase(),
        cusip,
        value1000s: valueStr ? parseInt(valueStr.replace(/,/g, ''), 10) : null,
        putCall: putCall || null,
      });
    }

    return holdings;
  } catch {
    return [];
  }
}

// Match holdings to our ticker universe by name (fuzzy)
function matchHoldingsToTickers(holdings, tickerSet) {
  const matched = [];

  // Build name fragments for each ticker we care about
  const NAME_HINTS = {
    'NVDA': ['NVIDIA'], 'AVGO': ['BROADCOM'], 'TSM': ['TAIWAN SEMI', 'TSMC'],
    'ASML': ['ASML'], 'AMAT': ['APPLIED MATERIAL'], 'APP': ['APPLOVIN'],
    'VRT': ['VERTIV'], 'NOW': ['SERVICENOW'], 'GOOGL': ['ALPHABET', 'GOOGLE'],
    'PLTR': ['PALANTIR'], 'DDOG': ['DATADOG'], 'MU': ['MICRON'], 'WDC': ['WESTERN DIGITAL'],
    'KLAC': ['KLA'], 'LRCX': ['LAM RESEARCH'], 'ANET': ['ARISTA'], 'MRVL': ['MARVELL'],
    'SNOW': ['SNOWFLAKE'], 'NET': ['CLOUDFLARE'], 'CIEN': ['CIENA'], 'MDB': ['MONGODB'],
    'ONTO': ['ONTO INNOVATION', 'NANOMETRICS'], 'ENTG': ['ENTEGRIS'],
    'LEU': ['CENTRUS'], 'BWXT': ['BWX TECH'], 'CCJ': ['CAMECO'],
    'VST': ['VISTRA'], 'ETN': ['EATON'], 'PWR': ['QUANTA'], 'GEV': ['GE VERNOVA'],
    'NXT': ['NEXTRACKER'], 'RKLB': ['ROCKET LAB'], 'OKLO': ['OKLO'],
    'ISRG': ['INTUITIVE SURGICAL'], 'HUBS': ['HUBSPOT'], 'GTLB': ['GITLAB'],
    'EMR': ['EMERSON'], 'ROK': ['ROCKWELL AUTO'], 'HUBB': ['HUBBELL'],
  };

  for (const [ticker, hints] of Object.entries(NAME_HINTS)) {
    if (!tickerSet.has(ticker)) continue;
    const holding = holdings.find(h =>
      hints.some(hint => h.nameOfIssuer.includes(hint))
    );
    if (holding) {
      matched.push({
        ticker,
        nameOfIssuer: holding.nameOfIssuer,
        value1000s:   holding.value1000s,
        valueMM:      holding.value1000s != null ? Math.round(holding.value1000s / 1000) : null,
        putCall:      holding.putCall,
      });
    }
  }

  return matched.sort((a, b) => (b.valueMM || 0) - (a.valueMM || 0));
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
  const managerResults = [];
  const errors         = [];

  // Build ticker-to-managers index
  const tickerOwnership = {};
  for (const t of ALL_TICKERS) tickerOwnership[t] = [];

  for (const manager of TRACKED_MANAGERS) {
    await new Promise(r => setTimeout(r, 200)); // rate limit

    try {
      const filing = await getMostRecent13F(manager.cik);
      if (!filing) {
        console.log(`${manager.name}: no 13F filing found`);
        managerResults.push({ ...manager, status: 'no_filing', filedDate: null, holdings: [] });
        continue;
      }

      // Fetch holdings XML
      await new Promise(r => setTimeout(r, 150));
      const holdings = await parse13FHoldings(filing.infoTable);
      const relevant = matchHoldingsToTickers(holdings, ALL_TICKERS);

      // Update ticker ownership index
      for (const h of relevant) {
        if (tickerOwnership[h.ticker]) {
          tickerOwnership[h.ticker].push({
            manager: manager.name,
            style:   manager.style,
            valueMM: h.valueMM,
            putCall: h.putCall,
          });
        }
      }

      console.log(`${manager.name}: 13F filed ${filing.filedDate}  relevant holdings: ${relevant.length}`);
      if (relevant.length > 0) {
        console.log(`  Top 5: ${relevant.slice(0, 5).map(h => `${h.ticker}($${h.valueMM}M)`).join('  ')}`);
      }

      managerResults.push({
        ...manager,
        status:       'ok',
        filedDate:    filing.filedDate,
        totalHoldings: holdings.length,
        relevantHoldings: relevant,
        indexUrl:     filing.indexUrl,
      });
    } catch (err) {
      errors.push({ manager: manager.name, error: err.message });
      console.warn(`WARN ${manager.name}: ${err.message}`);
    }
  }

  // Summarize: which tickers have most institutional backing
  const tickerSummary = Object.entries(tickerOwnership)
    .map(([ticker, owners]) => ({
      ticker,
      manager_count: owners.length,
      total_valueMM: owners.reduce((s, o) => s + (o.valueMM || 0), 0),
      managers: owners,
      institutional_signal: owners.length >= 3 ? 'STRONG' : owners.length >= 1 ? 'PRESENT' : 'NONE',
    }))
    .filter(t => t.manager_count > 0)
    .sort((a, b) => b.manager_count - a.manager_count);

  const output = {
    artifact:       'institutional-holdings',
    generatedAt:    new Date().toISOString(),
    source:         'SEC EDGAR 13F filings (data.sec.gov — free, 45-day lag)',
    note:           '13F filings are quarterly snapshots with 45-day reporting lag. Positions shown are end-of-quarter — actual current positions may differ significantly.',
    tracked_managers: TRACKED_MANAGERS.map(m => m.name),
    errors,
    ticker_ownership: tickerSummary,
    managers: managerResults,
  };

  const outPath = path.join(root, 'outputs', 'institutional-holdings.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\ninstitutional-holdings: ${TRACKED_MANAGERS.length} managers tracked  tickers with backing: ${tickerSummary.length}`);
  if (tickerSummary.length > 0) {
    console.log(`Institutional backing: ${tickerSummary.slice(0, 8).map(t => `${t.ticker}(${t.manager_count} mgrs,$${t.total_valueMM}M)`).join('  ')}`);
  }
})();
