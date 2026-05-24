const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const outputsDir = path.join(root, 'outputs');
const reportPath = path.join(outputsDir, 'homepage-legacy-strip-report.json');

const sectionIds = [
  'brief',
  'strategy-section',
  'chart-wall-section',
  'spx-cycle-map-section',
  'cycle-scenario-section',
  'visual-regime-section',
  'artifact-status-section',
];

const navTargets = [
  ['strategy-section', 'Strategy'],
  ['brief', 'Brief'],
  ['chart-wall-section', 'Regime Charts'],
  ['spx-cycle-map-section', 'SPX Map'],
  ['cycle-scenario-section', 'Cycle'],
];

const fallbackPatterns = [
  ['brief_to_holdings', /<section id="brief"[\s\S]*?(?=<section id="holdings-section")/gi],
  ['strategy_to_next', /<section id="strategy-section"[\s\S]*?(?=<section id="holdings-section"|<section id="artifact-status-section"|<footer)/gi],
  ['chart_wall_to_next', /<section id="chart-wall-section"[\s\S]*?(?=<section id="spx-cycle-map-section"|<section id="cycle-scenario-section"|<section id="strategy-section"|<section id="holdings-section")/gi],
  ['spx_cycle_map_to_next', /<section id="spx-cycle-map-section"[\s\S]*?(?=<section id="cycle-scenario-section"|<section id="strategy-section"|<section id="holdings-section")/gi],
  ['cycle_scenario_to_next', /<section id="cycle-scenario-section"[\s\S]*?(?=<section id="strategy-section"|<section id="holdings-section")/gi],
];

function countMatches(source, re) {
  const matches = source.match(re);
  return matches ? matches.length : 0;
}

function replaceAndCount(source, re, replacement = '') {
  const count = countMatches(source, re);
  if (!count) return { html: source, count };
  return { html: source.replace(re, replacement), count };
}

function writeReport(report) {
  fs.mkdirSync(outputsDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

if (!fs.existsSync(indexPath)) {
  const report = {
    generatedAt: new Date().toISOString(),
    status: 'SKIPPED',
    reason: 'index.html missing',
    bytes_removed: 0,
    section_removal_counts: {},
    fallback_removal_counts: {},
    nav_removal_counts: {},
    duplicate_nav_collapses: {},
  };
  writeReport(report);
  console.log('index missing');
  process.exit(0);
}

let html = fs.readFileSync(indexPath, 'utf8');
const before = html.length;
const section_removal_counts = {};
const fallback_removal_counts = {};
const nav_removal_counts = {};
const duplicate_nav_collapses = {};

for (const id of sectionIds) {
  const re = new RegExp(`<section\\s+id=["']${id}["'][\\s\\S]*?<\\/section>`, 'gi');
  const result = replaceAndCount(html, re, '');
  html = result.html;
  section_removal_counts[id] = result.count;
}

for (const [name, re] of fallbackPatterns) {
  const result = replaceAndCount(html, re, '');
  html = result.html;
  fallback_removal_counts[name] = result.count;
}

for (const [id, label] of navTargets) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<a href="#${id}">${escapedLabel}<\\/a>`, 'g');
  const result = replaceAndCount(html, re, '');
  html = result.html;
  nav_removal_counts[`#${id}`] = result.count;
}

const duplicatePatterns = [
  ['#decision-brief-section', /(<a href="#decision-brief-section">Brief<\/a>)(?:\s*\1)+/g, '$1'],
  ['#operational-chart-section', /(<a href="#operational-chart-section">Decision Chart<\/a>)(?:\s*\1)+/g, '$1'],
];

for (const [target, re, replacement] of duplicatePatterns) {
  const result = replaceAndCount(html, re, replacement);
  html = result.html;
  duplicate_nav_collapses[target] = result.count;
}

fs.writeFileSync(indexPath, html);

const bytes_removed = before - html.length;
const total_operations = [
  ...Object.values(section_removal_counts),
  ...Object.values(fallback_removal_counts),
  ...Object.values(nav_removal_counts),
  ...Object.values(duplicate_nav_collapses),
].reduce((sum, value) => sum + value, 0);

const report = {
  generatedAt: new Date().toISOString(),
  status: total_operations === 0 && bytes_removed === 0 ? 'NOOP' : 'CHANGED',
  bytes_removed,
  total_operations,
  section_removal_counts,
  fallback_removal_counts,
  nav_removal_counts,
  duplicate_nav_collapses,
  retirement_signal: total_operations === 0 && bytes_removed === 0 ? 'candidate_after_repeated_stable_noop_builds' : 'keep_active',
};

writeReport(report);
console.log(`stripped legacy homepage sections: ${bytes_removed} bytes removed; ${total_operations} operations recorded`);
console.log(`wrote ${path.relative(root, reportPath)}`);
