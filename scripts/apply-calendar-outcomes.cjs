'use strict';
/*
 * Closes out passed market-calendar events with verified outcomes.
 *
 * Why this exists: inject-market-calendar.cjs renders an event under
 * "What happened" only when it carries an `outcome`, and no pipeline step
 * ever wrote one — the Sep 16 FOMC outcome was hand-written once, and the
 * Oct 14 CPI sat as pre-release preview text for 9 days after the print
 * (flagged by Jun, 2026-10-17). This step is the closing-out half: it runs
 * in the market-orientation stage immediately before sync-market-events.cjs,
 * so everything derived from the calendar sees completed events.
 *
 * SOURCE CONTRACT — the only place outcomes may come from:
 *   data/market-calendar-outcomes.json, a checked-in ledger keyed by the
 *   same event id sync-market-events.cjs derives (`<type>-<date>`).
 *   An entry counts as VERIFIED only when decision, reaction, source, and
 *   verifiedAt are all present and non-empty. Entries are curated from
 *   figures the brief pipeline has already verified (Jun's graded event
 *   record). The narrative brief (outputs/narrative-reality-brief.json) is
 *   prose and is NEVER scraped for figures; this step fetches nothing and
 *   estimates nothing.
 *
 * FAIL CLOSED: a passed event with no verified ledger entry is left
 * without an outcome and logged. An existing outcome is never overwritten.
 * The outcome written to the calendar carries only { decision, reaction }
 * — the exact schema of the Sep 16 FOMC outcome; provenance (source,
 * verifiedAt) stays in the ledger.
 *
 * GATE — OFF BY DEFAULT: the step runs only when the environment sets
 * CAPITAL_RADAR_CALENDAR_OUTCOMES=1. As of 2026-10-23 no pipeline stage
 * emits the ledger automatically, so entries are added deliberately, the
 * same curation model as data/market-calendar.json itself (see the
 * sync-market-events.cjs header). Enabling the step with no new ledger
 * entries is a no-op. To make outcomes fully automatic, a future stage
 * must write the ledger from verified brief figures; until then a human
 * adds the entry and this step does the closing-out.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const calPath = path.join(root, 'data', 'market-calendar.json');
const ledgerPath = path.join(root, 'data', 'market-calendar-outcomes.json');

const ENABLED = process.env.CAPITAL_RADAR_CALENDAR_OUTCOMES === '1';

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeysDeep(value[key]);
    return out;
  }
  return value;
}

function isVerified(entry) {
  return Boolean(entry) && ['decision', 'reaction', 'source', 'verifiedAt']
    .every(k => typeof entry[k] === 'string' && entry[k].trim().length > 0);
}

function main() {
  if (!ENABLED) {
    console.log('apply-calendar-outcomes: disabled (set CAPITAL_RADAR_CALENDAR_OUTCOMES=1 to enable); calendar untouched.');
    return;
  }
  if (!fs.existsSync(ledgerPath)) {
    // Fail closed: no source, no outcomes — never invent a print.
    console.log('apply-calendar-outcomes: no verified-outcomes ledger (data/market-calendar-outcomes.json); leaving all outcomes untouched.');
    return;
  }

  const cal = JSON.parse(fs.readFileSync(calPath, 'utf8'));
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const entries = ledger.outcomes || {};
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  let wrote = 0;
  let keptExisting = 0;
  const leftOpen = [];

  for (const ev of (cal.events || [])) {
    if (!ev.date || !ev.type) continue;
    if (ev.outcome && (ev.outcome.decision || ev.outcome.reaction)) {
      keptExisting += 1; // never overwrite a recorded outcome
      continue;
    }
    if (!(ev.date < today)) continue; // event has not happened yet
    const id = `${ev.type}-${ev.date}`;
    const entry = entries[id];
    if (!isVerified(entry)) {
      leftOpen.push(id); // FAIL CLOSED: no verified figure, no outcome
      continue;
    }
    ev.outcome = { decision: entry.decision, reaction: entry.reaction };
    wrote += 1;
    console.log(`apply-calendar-outcomes: wrote outcome for ${id} (source verified ${entry.verifiedAt})`);
  }

  for (const id of leftOpen) {
    console.log(`apply-calendar-outcomes: ${id} has passed with no verified outcome on file — left open (fail closed).`);
  }

  if (wrote > 0) {
    cal.updated = today;
    fs.writeFileSync(calPath, JSON.stringify(sortKeysDeep(cal), null, 2) + '\n');
  }
  console.log(`apply-calendar-outcomes: ${wrote} outcome(s) written, ${leftOpen.length} passed event(s) left open, ${keptExisting} existing outcome(s) untouched.`);
}

main();
