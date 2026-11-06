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
 * SOURCE CONTRACT — outcomes may come from two places, both checked in:
 *   (1) data/market-calendar-outcomes.json, a ledger keyed by the same
 *       event id sync-market-events.cjs derives (`<type>-<date>`), curated
 *       from figures the brief pipeline has already verified (Jun's graded
 *       event record). An entry counts as VERIFIED only when decision,
 *       reaction, source, and verifiedAt are all present and non-empty.
 *   (2) Machine entries written by scripts/fetch-calendar-outcomes.cjs
 *       from FRED series (source "FRED ..."). Those carry a computed
 *       decision only — a market reaction cannot be computed from an index
 *       level and is never invented, so isVerified() accepts them without
 *       a reaction. The narrative brief (outputs/narrative-reality-brief.json)
 *       is prose and is NEVER scraped for figures; this step fetches nothing
 *       and estimates nothing.
 *
 * FAIL CLOSED: a passed event with no verified ledger entry is left
 * without an outcome and logged. An existing outcome is never overwritten.
 * The outcome written to the calendar carries { decision, reaction } when
 * a reaction exists, { decision } alone for machine entries — provenance
 * (source, verifiedAt) stays in the ledger.
 *
 * GATE — enabled by the lane runner (scripts/run-build-lane.cjs sets
 * CAPITAL_RADAR_CALENDAR_OUTCOMES=1 by default, overridable to '0').
 * With no new ledger entries the step is a no-op.
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
  if (!entry || typeof entry !== 'object') return false;
  const has = k => typeof entry[k] === 'string' && entry[k].trim().length > 0;
  if (!has('decision') || !has('source') || !has('verifiedAt')) return false;
  // Machine entries (source "FRED ...") carry a computed decision only;
  // a market reaction cannot be computed from an index level and is never
  // invented. Human-curated entries still require a reaction.
  if (String(entry.source).startsWith('FRED ')) return true;
  return has('reaction');
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
    ev.outcome = entry.reaction
      ? { decision: entry.decision, reaction: entry.reaction }
      : { decision: entry.decision };
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
