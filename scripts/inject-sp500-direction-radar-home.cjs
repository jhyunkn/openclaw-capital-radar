const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const mapPath = path.join(root, 'outputs', 'sp500-market-decision-map.json');

function fail(message) {
  console.error(`inject-sp500-direction-radar-home failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) fail('index.html missing');
if (!fs.existsSync(mapPath)) fail('outputs/sp500-market-decision-map.json missing; run generate:sp500-decision-map first');

const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const likelihoods = map.directionRadar?.marketDirectionLikelihoods || {};
const nextInflection = map.directionRadar?.nextInflection || 'Watch 20D/50D support, VIX, breadth, and credit confirmation.';
const markers = {
  start: '<!-- CAPITAL_RADAR_SP500_DIRECTION_RADAR_START -->',
  end: '<!-- CAPITAL_RADAR_SP500_DIRECTION_RADAR_END -->',
};

const section = `${markers.start}
<div id="sp500-direction-radar-card" class="capital-radar-sp500-radar" style="margin:28px 0;padding:22px;border:1px solid rgba(125,211,252,.28);border-radius:24px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(8,13,24,.98));color:#e5edf9;box-shadow:0 18px 60px rgba(2,6,23,.28)">
  <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7dd3fc;margin-bottom:8px">S&P 500 Direction Radar</div>
  <h2 style="margin:0 0 8px;font-size:clamp(24px,4vw,38px);line-height:1.05">${map.headline}</h2>
  <p style="margin:0 0 14px;color:#b9c6dc;max-width:980px">${nextInflection}</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px">
    <span style="border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:7px 10px">Continuation ${likelihoods.continuationPct ?? 'ΓÇö'}%</span>
    <span style="border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:7px 10px">Pullback / chop ${likelihoods.pullbackConsolidationPct ?? 'ΓÇö'}%</span>
    <span style="border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:7px 10px">Risk-off ${likelihoods.riskOffBreakdownPct ?? 'ΓÇö'}%</span>
    <span style="border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:7px 10px">${map.regime}</span>
  </div>
  <a href="/outputs/sp500-direction-radar.html" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:#08111f;background:#7dd3fc;border-radius:999px;padding:10px 14px;font-weight:800">Open S&P 500 radar ΓåÆ</a>
  <span style="display:inline-block;margin-left:10px;color:#93a4bc;font-size:13px">Annotated market-direction prototype inspired by JUTOPIA-style chart reading; not trade execution.</span>
</div>
${markers.end}`;

let html = fs.readFileSync(indexPath, 'utf8');
const re = new RegExp(`${markers.start}[\\s\\S]*?${markers.end}`);
if (re.test(html)) html = html.replace(re, section);
else if (html.includes('</section>')) html = html.replace('</section>', `${section}\n</section>`);
else if (html.includes('</body>')) html = html.replace('</body>', `${section}\n</body>`);
else html += `\n${section}\n`;

fs.writeFileSync(indexPath, html);
console.log(JSON.stringify({ ok: true, injected: 'sp500-direction-radar', headline: map.headline }, null, 2));
