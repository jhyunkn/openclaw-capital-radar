const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'outputs', 'data-refresh-state.json');

function readJson(rel, fallback = null) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (error) { return { status: 'UNREADABLE', error: error.message }; }
}

function ageHours(ts) {
  const t = Date.parse(ts || '');
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / 36e5);
}

function freshness(ts, staleAfterHours) {
  const age = ageHours(ts);
  if (age == null) return { status: 'missing', ageHours: null, staleAfterHours };
  if (age > staleAfterHours) return { status: 'stale', ageHours: Number(age.toFixed(1)), staleAfterHours };
  if (age > staleAfterHours * 0.5) return { status: 'aging', ageHours: Number(age.toFixed(1)), staleAfterHours };
  return { status: 'fresh', ageHours: Number(age.toFixed(1)), staleAfterHours };
}

const report = readJson('data/report-state.live.json', {});
const dataHealth = readJson('outputs/data-health.json', {});
const ledger = readJson('outputs/source-reliability-ledger.json', {});
const architecture = readJson('outputs/capital-radar-architecture-audit.json', {});
const actionState = readJson('outputs/authoritative-action-state.json', {});
const coverage = readJson('outputs/portfolio-thesis-coverage-map.json', {});
const opportunities = readJson('outputs/opportunity-evidence-packets.json', {});

const marketTs = dataHealth?.sources?.yahooFinance?.lastSuccessfulFetchAt || report?.meta?.normalizedAtBuild || report?.meta?.generatedAt;
const macroTs = dataHealth?.sources?.fred?.lastSuccessfulFetchAt || report?.meta?.normalizedAtBuild || report?.meta?.generatedAt;
const reportTs = report?.meta?.generatedAt || report?.meta?.normalizedAtBuild;
const ledgerTs = ledger?.generatedAt;
const architectureTs = architecture?.generatedAt;

const holdings = Array.isArray(report.holdings) ? report.holdings : [];
const thesisRows = Array.isArray(coverage.holdings) ? coverage.holdings : [];
const underwritten = thesisRows.filter(x => /underwritten/i.test(String(x.coverageState || x.state || ''))).length;
const constrained = thesisRows.filter(x => /constrained|partial|thin/i.test(String(x.coverageState || x.state || ''))).length;
const packets = Array.isArray(opportunities.packets) ? opportunities.packets : [];
const priority = packets.filter(p => Number(p.opportunityScore || 0) >= 70).length;
const blocked = packets.filter(p => Array.isArray(p.missingForPromotion) && p.missingForPromotion.length).length;
const authoritativeRows = Array.isArray(actionState.holdings) ? actionState.holdings : Array.isArray(actionState.actions) ? actionState.actions : [];
const capitalAllowed = authoritativeRows.filter(x => /allowed|add_review|capital_allowed/i.test(String(x.capitalPermission || x.permission || x.status || ''))).length;
const blockedActions = authoritativeRows.length ? authoritativeRows.length - capitalAllowed : null;

const state = {
  generatedAt: new Date().toISOString(),
  purpose: 'Top-of-page freshness and evidence coverage state for Capital Radar.',
  rows: [
    {
      id: 'market-prices',
      label: 'Market prices',
      value: marketTs || 'missing',
      detail: `${dataHealth?.sources?.yahooFinance?.tickerCount ?? holdings.length} tickers from public Yahoo chart adapter`,
      source: 'Yahoo public chart endpoint',
      ...freshness(marketTs, 24)
    },
    {
      id: 'macro-fred',
      label: 'Macro / FRED',
      value: macroTs || 'missing',
      detail: `${dataHealth?.sources?.fred?.seriesCount ?? 0} FRED series currently wired`,
      source: 'FRED public series',
      ...freshness(macroTs, 96)
    },
    {
      id: 'report-state',
      label: 'Report state',
      value: reportTs || 'missing',
      detail: `${holdings.length} holdings normalized into live public report`,
      source: 'Capital Radar report-state.live.json',
      ...freshness(reportTs, 24)
    },
    {
      id: 'source-ledger',
      label: 'Source ledger',
      value: ledgerTs || 'missing',
      detail: `${Array.isArray(ledger.sources) ? ledger.sources.length : 0} source families tracked; field-level ledger pending`,
      source: 'source-reliability-ledger',
      ...freshness(ledgerTs, 24)
    },
    {
      id: 'sec-company',
      label: 'SEC / company evidence',
      value: ledgerTs || 'collector pending',
      detail: 'SEC source registered; filings/XBRL collector is next build item',
      source: 'SEC submissions + XBRL planned spine',
      status: ledgerTs ? 'partial' : 'missing',
      ageHours: ledgerTs ? freshness(ledgerTs, 24).ageHours : null,
      staleAfterHours: 24
    },
    {
      id: 'news-catalysts',
      label: 'News / catalysts',
      value: 'not wired yet',
      detail: 'Materiality-scored news/catalyst scan is not yet powering decisions',
      source: 'future source collector',
      status: 'missing',
      ageHours: null,
      staleAfterHours: 24
    }
  ],
  coverage: {
    holdings: holdings.length,
    thesisUnderwritten: underwritten,
    thesisConstrained: constrained,
    opportunityPackets: packets.length,
    opportunityPriority: priority,
    opportunityBlockedByEvidence: blocked,
    capitalAllowed,
    capitalBlocked: blockedActions
  },
  blockers: [
    'SEC/XBRL primary-source collector not fully wired',
    'News/catalyst materiality collector not wired',
    'Field-level evidence ledger pending',
    'BMNR/TSNF decision packets not yet evidence-complete'
  ],
  architectureAuditAt: architectureTs || null
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n');
console.log(`generated data refresh state: ${path.relative(root, outPath)}`);
