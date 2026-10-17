'use strict';
// Price-basis derivation for the Robinhood broker sync.
//
// The positions snapshot (outputs/robinhood-positions.json) carries ONE
// syncedAt instant, and every price in it was marked at that instant. When
// the sync ran mid-session, those prices are an intraday snapshot — the
// 2026-10-16 sync ran 18:50:47Z (2:50 PM ET), so the page's "Oct 16 prices"
// were 2:50 PM prints, not closes (SPY $761.90 vs the $763.25 close). Any
// surface that shows sync-derived prices must say which basis it is on.
//
// Rule (derived from syncedAt alone — never hardcoded text):
//   - weekday (Mon–Fri, America/New_York) before 16:00 ET → intraday basis
//   - weekday at/after 16:00 ET, or a weekend sync (prior session's marks)
//     → close basis
function describeSyncBasis(syncedAt) {
  const d = syncedAt instanceof Date ? syncedAt : new Date(syncedAt);
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d);
  const g = t => (parts.find(p => p.type === t) || {}).value || '';
  const stamp = `${g('month')} ${g('day')}, ${g('year')} · ${g('hour')}:${g('minute')} ${g('dayPeriod')} ET`;
  const wd = g('weekday');
  const weekend = wd === 'Sat' || wd === 'Sun';
  const hm = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const hg = t => Number((hm.find(p => p.type === t) || {}).value || 0);
  const minutes = hg('hour') * 60 + hg('minute');
  const intraday = !weekend && minutes < 16 * 60;
  return {
    stamp,
    basis: intraday ? 'intraday' : 'close',
    label: intraday ? 'intraday snapshot — not closing prices' : 'closing prices as of this sync',
  };
}

module.exports = { describeSyncBasis };
