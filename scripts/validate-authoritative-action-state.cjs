const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const actionPath = path.join(root, 'outputs', 'authoritative-action-state.json');
if (!fs.existsSync(actionPath)) throw new Error('Missing outputs/authoritative-action-state.json');
const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));
const states = action.actionStates || [];
const errors = [];
for (const s of states) {
  if (!s.ticker) errors.push('missing ticker');
  if (!s.authority?.decision) errors.push(`${s.ticker}: missing authority decision`);
  if (!s.authority?.allowed || !s.authority?.forbidden) errors.push(`${s.ticker}: missing allowed/forbidden action`);
  if (!Array.isArray(s.priceLadder) || !s.priceLadder.length) errors.push(`${s.ticker}: missing strategy ladder`);
  if (s.zone?.state === 'BELOW_HARD_EXIT') {
    if (s.authority.decision !== 'EXIT REVIEW') errors.push(`${s.ticker}: below hard exit must be EXIT REVIEW`);
    if (!/Do not add|average down/i.test(s.authority.forbidden)) errors.push(`${s.ticker}: below hard exit must forbid adding`);
    if (!/invalidated/i.test(s.moduleDirective?.buyZoneLabel || '')) errors.push(`${s.ticker}: below hard exit must invalidate buy zone label`);
  }
  if (s.moduleDirective?.proximityEligible && s.authority.decision !== 'ADD REVIEW ALLOWED') errors.push(`${s.ticker}: proximity eligible without add-review permission`);
}
for (const s of states) {
  const file = path.join(root, 'pages', `${s.ticker.toLowerCase()}.html`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('id="authoritative-action-state"')) errors.push(`${s.ticker}: ticker page missing authoritative action section`);
  if (!html.includes('Strategy ladder')) errors.push(`${s.ticker}: ticker page missing strategy ladder`);
}
const home = path.join(root, 'index.html');
if (fs.existsSync(home)) {
  const html = fs.readFileSync(home, 'utf8');
  if (!html.includes('id="authoritative-action-home"')) errors.push('homepage missing authoritative action layer');
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`authoritative action state valid: ${states.length} tickers`);
