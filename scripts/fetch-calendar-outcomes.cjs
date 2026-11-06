'use strict';
/*
 * fetch-calendar-outcomes.cjs
 *
 * Machine-writes verified outcomes for past-dated CPI / PCE / jobs events
 * into the checked-in ledger (data/market-calendar-outcomes.json), from
 * FRED series via scripts/lib/fetch-fred.cjs (curl, default User-Agent
 * only — never add -A; see that file's transport note).
 * apply-calendar-outcomes.cjs then closes the calendar out; this step
 * never touches data/market-calendar.json directly.
 *
 * Reference month: monthly releases print the prior month (CPI for Sep is
 * released mid-Oct), so refMonth = release month - 1. Jobs: PAYEMS is the
 * payroll level (thousands, SA); the gain is ref level minus prior level.
 * m/m and y/y are computed from index levels, rounded to one decimal.
 *
 * FAIL CLOSED: an event is skipped (logged) when any needed observation
 * is missing, when a computed value is not finite, or when the ledger
 * already has an entry. Nothing is estimated, nothing is invented.
 * A reaction string is never machine-written — the ledger entry carries
 * decision + source + verifiedAt only; isVerified() in
 * apply-calendar-outcomes.cjs accepts FRED entries without a reaction.
 *
 * DRY RUN: --dry-run computes and prints without writing. With an event
 * id argument (--dry-run cpi-2026-10-14) it recomputes that one event
 * regardless of ledger/date guards, so the math can be checked against a
 * known print (Sep 2026 CPI: headline +0.6% m/m, 3.7% y/y; core +0.3%
 * m/m, 2.6% y/y).
 */
const fs = require('fs');
const path = require('path');
const { fetchFredSeries } = require('./lib/fetch-fred.cjs');

const root = path.join(__dirname, '..');
const calPath = path.join(root, 'data', 'market-calendar.json');
const ledgerPath = path.join(root, 'data', 'market-calendar-outcomes.json');

const SERIES = {
  cpi: { headline: 'CPIAUCSL', core: 'CPILFESL', label: 'CPI' },
  pce: { headline: 'PCEPI', core: 'PCEPILFE', label: 'PCE' },
  jobs: { payrolls: 'PAYEMS', unemployment: 'UNRATE', label: 'jobs' },
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key]);
    return out;
  }
  return value;
}

function refMonthOf(dateStr) {
  // dateStr YYYY-MM-DD (release date) -> prior month YYYY-MM.
  const [y, m] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function yearAgoMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function fmtPct(v) {
  const r = Math.round(v * 10) / 10;
  return `${r >= 0 ? '+' : ''}${r.toFixed(1)}%`;
}

function pctChange(now, before) {
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) return null;
  return (now / before - 1) * 100;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyId = args.find(a => !a.startsWith('--') && a !== '--dry-run') || null;

  const cal = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  const ledger = fs.existsSync(ledgerPath)
    ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
    : { outcomes: {} };
  const entries = ledger.outcomes || {};
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const cache = {};
  async function series(id) {
    if (!cache[id]) cache[id] = await fetchFredSeries(id).catch(e => ({ error: String(e.message || e) }));
    return cache[id];
  }
  function valueAt(obs, ym) {
    const row = (obs || []).find(r => r.date === `${ym}-01`);
    return row && Number.isFinite(row.value) ? row.value : null;
  }

  let wrote = 0;
  let skipped = 0;

  for (const ev of (cal.events || [])) {
    if (!ev.date || !ev.type || !SERIES[ev.type]) continue;
    const id = `${ev.type}-${ev.date}`;
    if (onlyId && id !== onlyId) continue;
    if (!onlyId) {
      if (!(ev.date < today)) continue; // not yet released
      if (ev.outcome && (ev.outcome.decision || ev.outcome.reaction)) continue; // already decided
      if (entries[id]) continue; // ledger already has it
    }
    const ref = refMonthOf(ev.date);
    const spec = SERIES[ev.type];
    let decision = null;
    let source = null;
    try {
      if (ev.type === 'jobs') {
        const pay = await series(spec.payrolls);
        const un = await series(spec.unemployment);
        if (pay.error) throw new Error(`FRED ${spec.payrolls}: ${pay.error}`);
        if (un.error) throw new Error(`FRED ${spec.unemployment}: ${un.error}`);
        const cur = valueAt(pay.observations, ref);
        const prev = valueAt(pay.observations, prevMonth(ref));
        const rate = valueAt(un.observations, ref);
        if (cur === null || prev === null) throw new Error(`PAYEMS missing ${ref} or ${prevMonth(ref)}`);
        if (rate === null) throw new Error(`UNRATE missing ${ref}`);
        const gain = Math.round(cur - prev); // thousands
        decision = `${monthLabel(ref)} payrolls ${gain >= 0 ? '+' : ''}${gain}k (FRED PAYEMS); unemployment ${rate.toFixed(1)}% (FRED UNRATE).`;
        source = `FRED ${spec.payrolls}/${spec.unemployment}`;
      } else {
        const head = await series(spec.headline);
        const core = await series(spec.core);
        if (head.error) throw new Error(`FRED ${spec.headline}: ${head.error}`);
        if (core.error) throw new Error(`FRED ${spec.core}: ${core.error}`);
        const h = valueAt(head.observations, ref);
        const hPrev = valueAt(head.observations, prevMonth(ref));
        const hYr = valueAt(head.observations, yearAgoMonth(ref));
        const c = valueAt(core.observations, ref);
        const cPrev = valueAt(core.observations, prevMonth(ref));
        const cYr = valueAt(core.observations, yearAgoMonth(ref));
        if ([h, hPrev, hYr, c, cPrev, cYr].some(v => v === null)) {
          throw new Error(`${spec.headline}/${spec.core} missing an observation for ${ref}`);
        }
        const hMm = pctChange(h, hPrev);
        const hYy = pctChange(h, hYr);
        const cMm = pctChange(c, cPrev);
        const cYy = pctChange(c, cYr);
        if ([hMm, hYy, cMm, cYy].some(v => v === null)) throw new Error('non-finite computed change');
        decision = `${monthLabel(ref)} ${spec.label} (FRED ${spec.headline}/${spec.core}): headline ${fmtPct(hMm)} m/m, ${fmtPct(hYy)} y/y; core ${fmtPct(cMm)} m/m, ${fmtPct(cYy)} y/y.`;
        source = `FRED ${spec.headline}/${spec.core}`;
      }
    } catch (e) {
      console.log(`fetch-calendar-outcomes: ${id} skipped — ${e.message}`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`fetch-calendar-outcomes: [dry-run] ${id} would write: ${decision}`);
      continue;
    }
    entries[id] = { decision, source, verifiedAt: today };
    wrote += 1;
    console.log(`fetch-calendar-outcomes: wrote ledger entry for ${id}`);
  }

  if (!dryRun && wrote > 0) {
    ledger.outcomes = entries;
    fs.writeFileSync(ledgerPath, JSON.stringify(sortKeysDeep(ledger), null, 2) + '\n');
  }
  console.log(`fetch-calendar-outcomes: ${wrote} ledger entr${wrote === 1 ? 'y' : 'ies'} written, ${skipped} skipped${dryRun ? ' (dry run — nothing written)' : ''}.`);
}

main().catch(e => { console.error(`fetch-calendar-outcomes: fatal: ${e.message || e}`); process.exit(1); });
