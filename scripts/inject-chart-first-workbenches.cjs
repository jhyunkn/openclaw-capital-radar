const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
if (!fs.existsSync(pagesDir)) throw new Error('pages directory missing');
if (!fs.existsSync(interpPath)) throw new Error('strategy-interpretations.json missing');
const strategy = JSON.parse(fs.readFileSync(interpPath, 'utf8'));
const interpretations = new Map((strategy.interpretations || []).map(x => [String(x.ticker || '').toLowerCase(), x]));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toneClass(value){ const tone = String(value || '').toLowerCase(); if(tone.includes('danger')) return 'bad'; if(tone.includes('caution')) return 'warn'; if(tone.includes('positive')) return 'good'; return 'neutral'; }
function boundaryText(item){ const b = item?.nearestDecisionBoundary; if(!b || !Number.isFinite(b.distancePct)) return 'No mapped boundary'; return `${b.label}: ${b.distancePct >= 0 ? '+' : ''}${b.distancePct.toFixed(2)}% to ${Number(b.value).toFixed(2)}`; }
function signalChanges(item){ const list = Array.isArray(item?.signalChangeConditions) ? item.signalChangeConditions : []; return list.slice(0,3).map(x => `<li>${esc(x)}</li>`).join('') || '<li>No signal-change conditions mapped.</li>'; }
function chartHeader(item){
  return `<div class="chart-strategy-header"><article class="${toneClass(item?.actionPermission?.tone)}"><span>Action permission</span><b>${esc(item?.actionPermission?.status || 'Review')}</b><p>${esc(item?.actionPermission?.reason || 'No interpreted reason available.')}</p></article><article class="${toneClass(item?.urgency?.tone)}"><span>Urgency</span><b>${esc(item?.urgency?.level || 'Monitor')}</b><p>${esc(item?.urgency?.reason || 'No urgent condition detected.')}</p></article><article><span>Nearest boundary</span><b>${esc(boundaryText(item))}</b><p>Use chart to verify whether this boundary is structurally valid, not merely close.</p></article><article class="${toneClass(item?.decisionConfidence?.tone)}"><span>Decision confidence</span><b>${esc(item?.decisionConfidence?.level || 'Medium')}${Number.isFinite(item?.decisionConfidence?.score) ? ` / ${item.decisionConfidence.score}` : ''}</b><p>${esc(item?.decisionConfidence?.reason || 'Confidence unavailable.')}</p></article></div><div class="chart-signal-change"><span>Signal changes if</span><ul>${signalChanges(item)}</ul></div>`;
}
const css = `<style>.chart-section{padding-top:28px!important}.chart-strategy-header{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-bottom:18px}.chart-strategy-header article{padding:16px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18);min-height:132px}.chart-strategy-header span,.chart-signal-change span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:500}.chart-strategy-header b{display:block;font-size:24px;line-height:1.02;letter-spacing:-.04em;margin-top:9px}.chart-strategy-header p{font-size:13px;line-height:1.38;margin-top:10px;color:rgba(36,35,31,.78)}.chart-strategy-header .good b{color:var(--green)}.chart-strategy-header .warn b{color:var(--warn)}.chart-strategy-header .bad b{color:var(--red)}.chart-signal-change{border:1px solid var(--rule);background:rgba(251,250,246,.14);padding:14px 16px;margin-bottom:18px}.chart-signal-change ul{margin:10px 0 0;padding-left:18px}.chart-signal-change li{font-size:13px;line-height:1.42;margin:5px 0}.tv-wrap{height:min(70vh,720px)!important}.tv-placeholder{display:none!important}.tvchart{display:block!important;height:100%!important;width:100%!important}@media(max-width:1000px){.chart-strategy-header{grid-template-columns:1fr 1fr}.tv-wrap{height:560px!important}}@media(max-width:640px){.chart-strategy-header{grid-template-columns:1fr}.tv-wrap{height:460px!important}}</style>`;
let count = 0;
for (const file of fs.readdirSync(pagesDir).filter(x => x.endsWith('.html'))) {
  const ticker = file.replace(/\.html$/, '').toLowerCase();
  const item = interpretations.get(ticker);
  const filePath = path.join(pagesDir, file);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<style>\.chart-strategy-header[\s\S]*?<\/style>/, '');
  html = html.replace(/<div class="chart-strategy-header"[\s\S]*?<div class="tv-wrap"/, '<div class="tv-wrap"');
  html = html.replace(/<div class="chart-signal-change"[\s\S]*?<div class="tv-wrap"/, '<div class="tv-wrap"');
  html = html.replace('</head>', `${css}</head>`);
  html = html.replace('<div class="tv-wrap"', `${chartHeader(item)}<div class="tv-wrap"`);
  html = html.replace(/<div id="(tradingview_[^"]+)" class="tvchart" hidden><\/div>/g, '<div id="$1" class="tvchart"></div>');
  html = html.replace(/document\.addEventListener\('click',function\(e\)\{var btn=e\.target\.closest\('\.load-tv'\);if\(!btn\)return;var wrap=btn\.closest\('\.tv-wrap'\);if\(wrap\)mount\(wrap\)\}\);/, "document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('.tv-wrap').forEach(function(wrap){mount(wrap)})});document.addEventListener('click',function(e){var btn=e.target.closest('.load-tv');if(!btn)return;var wrap=btn.closest('.tv-wrap');if(wrap)mount(wrap)});");
  const chartMatch = html.match(/<section class="section chart-section">[\s\S]*?<\/section>/);
  if (chartMatch) {
    html = html.replace(chartMatch[0], '');
    const insertAfter = html.match(/<section class="grid metrics">[\s\S]*?<\/section>/);
    if (insertAfter) html = html.replace(insertAfter[0], `${insertAfter[0]}${chartMatch[0]}`);
    else html = html.replace('</header>', `</header>${chartMatch[0]}`);
  }
  fs.writeFileSync(filePath, html);
  count++;
}
console.log(`converted ${count} workbenches to chart-first auto-loading strategy surfaces`);
