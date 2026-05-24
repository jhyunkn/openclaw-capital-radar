const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderSystemHealthSection, renderSystemHealthStyle } = require('../components/radar/system-health/render.cjs');

const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'outputs', 'capital-radar-health-report.json');
const htmlPath = path.join(root, 'outputs', 'system-health-section.html');
const stylePath = path.join(root, 'outputs', 'system-health-style.html');

spawnSync(process.execPath, [path.join(__dirname, 'generate-capital-radar-health-report.cjs')], { cwd: root, stdio: 'inherit' });
if (!fs.existsSync(reportPath)) throw new Error('capital radar health report missing');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
fs.writeFileSync(htmlPath, renderSystemHealthSection(report));
fs.writeFileSync(stylePath, renderSystemHealthStyle());
console.log('rendered system health section fragments');
