const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(interpPath)) throw new Error('strategy-interpretations.json missing; run generate-strategy-interpretations first');
const data = JSON.parse(fs.readFileSync(interpPath, 'utf8'));
const items = Array.isArray(data.interpretations) ? data.interpretations : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toneClass(value){ const tone = String(value || '').toLowerCase(); if(tone.includes('danger')) return 'bad'; if(tone.includes('caution')) return 'warn'; if(tone.includes('positive')) return 'good'; return 'neutral'; }
function sortByUrgency(a,b){ const rank = { Now:0, 'This week':1, Soon:2, Monitor:3 }; return (rank[a.urgency?.level] ?? 9) - (rank[b.urgency?.level] ?? 9); }
const actNow = items.filter(x => x.urgency?.level === 'Now');
const reviewSoon = items.filter(x => ['This week','Soon'].includes(x.urgency?.level)).sort(sortByUrgency);
const blocked = items.filter(x => /No add|No action|Hold only|verify/i.test(x.actionPermission?.status || ''));
const weakData = items.filter(x => x.dataConfidence?.tone !== 'positive');
const conflicts = items.filter(x => x.portfolioConflict?.tone !== 'positive');
const highConfidence = items.filter(x => x.decisionConfidence?.level === 'High');
function listLine(arr, fallback){ return arr.length ? arr.slice(0,4).map(x => x.ticker).join(' · ') : fallback; }
function card(label, value, detail, cls='neutral') { return `<article class="command-tile ${cls}"><span>${esc(label)}</span><b>${esc(value)}</b><p>${esc(detail)}</p></article>`; }
function queueCard(item){ return `<a class="command-queue-card ${toneClass(item.urgency?.tone)}" href="pages/${String(item.ticker).toLowerCase()}.html#strategy-interpreter"><div><b>${esc(item.ticker)}</b><em>${esc(item.urgency?.level || 'Monitor')}</em></div><p>${esc(item.actionPermission?.status || 'Review')}</p><small>${esc((item.newInformation || [])[0] || item.actionPermission?.reason || 'No material pressure detected.')}</small></a>`; }
const html = `<section id="strategy-command" class="panel strategy-command"><div class="section-head"><div><p class="eyebrow">Strategy Command</p><h2>What deserves attention now</h2></div><a class="button" href="outputs/strategy-interpretations.json">Open strategy JSON</a></div><div class="command-grid">${card('Act now', String(actNow.length), listLine(actNow,'No immediate action flags.'), actNow.length ? 'bad' : 'good')}${card('Review soon', String(reviewSoon.length), listLine(reviewSoon,'No near-term review pressure.'), reviewSoon.length ? 'warn' : 'good')}${card('Blocked adds', String(blocked.length), listLine(blocked,'No add blocks detected.'), blocked.length ? 'warn' : 'good')}${card('Weak data', String(weakData.length), listLine(weakData,'No major data gaps.'), weakData.length ? 'bad' : 'good')}${card('Portfolio conflicts', String(conflicts.length), listLine(conflicts,'No major concentration conflicts.'), conflicts.length ? 'warn' : 'good')}${card('High confidence', String(highConfidence.length), listLine(highConfidence,'No high-confidence decisions yet.'), 'good')}</div><div class="section-head compact command-subhead"><div><p class="eyebrow">Review queue</p><h3>Highest-priority interpreted cards</h3></div></div><div class="command-queue">${[...actNow, ...reviewSoon, ...blocked].filter((item, index, arr) => arr.findIndex(x => x.ticker === item.ticker) === index).slice(0,8).map(queueCard).join('') || '<p class="muted">No interpreted review queue.</p>'}</div></section>`;
const css = `<style>.strategy-command{background:#ffffff}.command-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.command-tile{padding:18px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff}.command-tile span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}.command-tile b{display:block;font-size:44px;line-height:.9;letter-spacing:-.06em;font-weight:500}.command-tile p{font-size:13px;margin-top:12px;color:rgba(36,35,31,.78)}.command-tile.good b{color:var(--green)}.command-tile.warn b{color:var(--warn)}.command-tile.bad b{color:var(--red)}.command-subhead{margin-top:26px}.command-queue{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.command-queue-card{display:block;text-decoration:none;color:inherit;padding:16px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff}.command-queue-card div{display:flex;justify-content:space-between;gap:12px}.command-queue-card b{font-size:26px;line-height:1;letter-spacing:-.045em}.command-queue-card em{font-style:normal;font-size:12px;text-transform:uppercase;letter-spacing:.05em}.command-queue-card p{font-weight:600;margin-top:12px}.command-queue-card small{display:block;margin-top:8px;color:var(--muted);line-height:1.35}.command-queue-card.good em{color:var(--green)}.command-queue-card.warn em{color:var(--warn)}.command-queue-card.bad em{color:var(--red)}</style>`;
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<style>\.strategy-command[\s\S]*?<\/style>/, '');
index = index.replace(/<section id="strategy-command"[\s\S]*?<section id="brief"/, '<section id="brief"');
index = index.replace('</head>', `${css}</head>`);
if (index.includes('<section id="brief"')) index = index.replace('<section id="brief"', `${html}<section id="brief"`);
else index = index.replace('<section id="holdings-section"', `${html}<section id="holdings-section"`);
fs.writeFileSync(indexPath, index);
console.log(`injected strategy command summary for ${items.length} interpreted holdings`);
