const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const notesDir = path.join(root, 'agent-notes', 'tickers');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = value => Array.isArray(value) ? value : [];
function readNote(ticker) {
  const file = path.join(notesDir, `${String(ticker).toLowerCase()}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function bullets(items) {
  return `<ul>${list(items).map(item => `<li>${esc(item)}</li>`).join('') || '<li>Agent note pending.</li>'}</ul>`;
}
function levels(items) {
  return list(items).length ? list(items).map(x => typeof x === 'number' ? `$${x.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : esc(x)).join(' · ') : '—';
}
function htmlFor(note) {
  const log = list(note.agentLog).slice(-3).reverse();
  return `<section class="section agent-intelligence" id="agent-intelligence"><div class="section-head"><div><p class="eyebrow">OpenClaw Agent Intelligence</p><h2>Editable strategic dossier</h2></div><a class="agent-note-link" href="/agent-notes/tickers/${esc(String(note.ticker).toLowerCase())}.json">Open note JSON</a></div><div class="agent-grid"><article class="agent-panel thesis-panel"><span>Base thesis</span><p>${esc(note.agentThesis?.baseCase || 'Agent thesis pending.')}</p><div class="bias-row"><b>${esc(note.agentThesis?.currentBias || 'Review')}</b><em>${Math.round(Number(note.agentThesis?.confidence || 0) * 100)}% confidence</em></div></article><article class="agent-panel"><span>Bull case</span><p>${esc(note.agentThesis?.bullCase || 'Pending.')}</p></article><article class="agent-panel"><span>Bear case</span><p>${esc(note.agentThesis?.bearCase || 'Pending.')}</p></article><article class="agent-panel"><span>Invalidation</span><p>${esc(note.agentThesis?.invalidation || 'Pending.')}</p></article></div><div class="agent-map"><article><span>Trend regime</span><b>${esc(note.technicalMap?.trendRegime || 'Pending')}</b><p>${esc(note.technicalMap?.multiTimeframeRead || '')}</p></article><article><span>Support</span><b>${levels(note.technicalMap?.supportLevels)}</b><p>Buy zone: ${levels(note.technicalMap?.buyZone)}</p></article><article><span>Resistance</span><b>${levels(note.technicalMap?.resistanceLevels)}</b><p>Trim zone: ${levels(note.technicalMap?.trimZone)}</p></article><article><span>Stop / review</span><b>${levels(note.technicalMap?.stopZone)}</b><p>${esc(note.technicalMap?.fractalRead || '')}</p></article></div><div class="protocol-grid"><article><span>Hold if</span>${bullets(note.strategyProtocol?.holdIf)}</article><article><span>Add if</span>${bullets(note.strategyProtocol?.addIf)}</article><article><span>Trim if</span>${bullets(note.strategyProtocol?.trimIf)}</article><article><span>Exit if</span>${bullets(note.strategyProtocol?.exitIf)}</article><article><span>Do nothing if</span>${bullets(note.strategyProtocol?.doNothingIf)}</article><article><span>Open questions</span>${bullets(note.openQuestions)}</article></div><div class="agent-log"><div class="section-head compact"><div><p class="eyebrow">Reasoning log</p><h3>What changed / what remains uncertain</h3></div></div>${log.map(entry => `<article><b>${esc(entry.date)}</b><p>${esc(entry.observation)}</p><p><strong>Changed:</strong> ${esc(entry.changedSinceLastReview)}</p><p><strong>Reaction:</strong> ${esc(entry.recommendedReaction)}</p><p><strong>Uncertainty:</strong> ${esc(entry.uncertainty)}</p><p><strong>Next check:</strong> ${esc(entry.nextCheck)}</p></article>`).join('')}</div></section>`;
}
const css = `<style>.agent-intelligence{background:rgba(251,250,246,.13)}.agent-note-link{border:1px solid var(--rule);border-radius:999px;padding:10px 14px;text-decoration:none;font-size:13px;color:var(--muted)}.agent-note-link:hover{color:var(--ink);border-color:rgba(36,35,31,.55)}.agent-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.agent-panel,.agent-map article,.protocol-grid article,.agent-log article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:18px;background:rgba(251,250,246,.18)}.agent-panel span,.agent-map span,.protocol-grid span{display:block;color:var(--muted);font-size:13px;margin-bottom:12px}.agent-panel p{font-size:15px}.bias-row{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:18px;border-top:1px solid var(--rule);padding-top:14px}.bias-row b{font-size:26px;letter-spacing:-.04em}.bias-row em{font-style:normal;color:var(--muted);font-size:13px}.agent-map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.agent-map b{display:block;font-size:26px;line-height:1;letter-spacing:-.04em;font-weight:500;margin-bottom:12px}.protocol-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.protocol-grid ul{margin:0;padding-left:18px}.protocol-grid li{margin:0 0 8px;color:rgba(36,35,31,.84);line-height:1.42}.agent-log{margin-top:24px}.agent-log article{border-left:1px solid var(--rule);border-top:1px solid var(--rule);margin-bottom:0}.agent-log b{display:block;font-size:18px;margin-bottom:10px}.agent-log p{margin-top:6px;font-size:14px}@media(max-width:1100px){.agent-grid,.agent-map,.protocol-grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.agent-grid,.agent-map,.protocol-grid{grid-template-columns:1fr}.section-head{align-items:flex-start}}</style>`;
let count = 0;
for (const h of holdings) {
  const ticker = h.ticker;
  const note = readNote(ticker);
  if (!note) continue;
  const pagePath = path.join(pagesDir, `${String(ticker).toLowerCase()}.html`);
  if (!fs.existsSync(pagePath)) continue;
  let page = fs.readFileSync(pagePath, 'utf8');
  page = page.replace(/<style>\.agent-intelligence[\s\S]*?<\/style>/, '');
  page = page.replace(/<section class="section agent-intelligence"[\s\S]*?<section class="section chart-section">/, '<section class="section chart-section">');
  if (!page.includes('.agent-intelligence')) page = page.replace('</head>', `${css}</head>`);
  const marker = '<section class="section chart-section">';
  page = page.replace(marker, `${htmlFor(note)}${marker}`);
  fs.writeFileSync(pagePath, page);
  count += 1;
}
console.log(`injected agent intelligence into ${count} ticker workspaces`);
