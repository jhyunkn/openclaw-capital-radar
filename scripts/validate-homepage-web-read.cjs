const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const outputsDir = path.join(root, 'outputs');
const reportPath = path.join(outputsDir, 'homepage-web-read-validation-report.json');
const requiredIds = ['decision-brief-section', 'operational-chart-section', 'holdings-section', 'opportunities-section'];
const forbiddenIds = [
  'data-refresh-section',
  'kostolany-egg-section',
  'macro-unified-section',
  'market-lens-section',
  'strategy-routing-section',
  'market-section',
  'system-health-section',
  'macro-cycle-section',
  'trust-section',
];

function report(status, errors, details) {
  fs.mkdirSync(outputsDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), status, errors, ...details }, null, 2) + '\n');
}

function count(re, s) {
  return (s.match(re) || []).length;
}

function strip(s) {
  return String(s || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countClassToken(html, token) {
  const classAttrs = [...html.matchAll(/class=["']([^"']*)["']/g)].map(match => match[1]);
  return classAttrs.filter(value => value.split(/\s+/).includes(token)).length;
}

if (!fs.existsSync(indexPath)) {
  report('FAILED', ['index.html missing'], {});
  throw new Error('index.html missing');
}

const html = fs.readFileSync(indexPath, 'utf8');
const bodyHtml = (html.match(/<body[\s\S]*?<\/body>/i) || [html])[0];
const text = strip(bodyHtml);
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const finalFour = JSON.stringify(sectionIds) === JSON.stringify(requiredIds);

if (!finalFour) {
  const message = `section contract mismatch: expected ${requiredIds.join(' > ')} got ${sectionIds.join(' > ')}`;
  report('FAILED', [message], {
    mode: 'FINAL_FOUR_SECTION_VALIDATION',
    section_ids: sectionIds,
    text_sample: text.slice(0, 600),
  });
  console.error(`Homepage web-read validation failed: ${message}`);
  process.exit(1);
}

const errors = [];
const topbarCount = countClassToken(html, 'topbar');
const mainNavCount = count(/<nav class=["']nav["']/g, html);
const innerEggNavCount = count(/class=["']ke-nav["']|class=["'][^"']*\bke-topbar\b/g, html);
const brandCount = count(/OpenClaw Capital Radar/g, text);
const heroIndex = html.indexOf('<header class="hero"');
const firstSectionIndex = html.search(/<section\b[^>]*id=["'][^"']+["']/);
const sectionCounts = Object.fromEntries(requiredIds.map(id => [id, count(new RegExp(`id=["']${id}["']`, 'g'), html)]));
const forbiddenPresent = forbiddenIds.filter(id => count(new RegExp(`id=["']${id}["']`, 'g'), html));
const visibleNotAvailable = count(/not available/g, text);
const zoneCards = count(/class=["'][^"']*\bzone-card\b/g, html);

if (topbarCount !== 1) errors.push(`topbar_count=${topbarCount}; expected 1`);
if (mainNavCount !== 1) errors.push(`main_nav_count=${mainNavCount}; expected 1`);
if (innerEggNavCount !== 0) errors.push(`inner_egg_nav_or_topbar_count=${innerEggNavCount}; expected 0`);
if (brandCount > 2) errors.push(`brand_text_count=${brandCount}; expected <=2 including footer`);
if (heroIndex < 0) errors.push('hero_missing');
if (firstSectionIndex >= 0 && heroIndex >= 0 && heroIndex > firstSectionIndex) errors.push('first_section_appears_before_hero');
for (const [id, n] of Object.entries(sectionCounts)) if (n !== 1) errors.push(`${id}_count=${n}; expected 1`);
if (forbiddenPresent.length) errors.push(`forbidden_sections_present=${forbiddenPresent.join(',')}`);
if (visibleNotAvailable > 0) errors.push(`visible_not_available_count=${visibleNotAvailable}`);
if (!/Macro|Market permission|Decision chart|Holdings|Opportunity/i.test(text)) errors.push('missing_four_section_language');
if (!/Risk rule|Confirmation|VIX|10Y|M2|invalidation/i.test(text)) errors.push('missing_macro_decision_terms');
if (!/SPX|ADD|TRIM|DEFENSE/i.test(text)) errors.push('missing_decision_chart_terms');
if (!/Buy|Trim|Stop|Exit|AUTH|PARTIAL|PROXY|MISSING/i.test(text)) errors.push('missing_holdings_terms');
if (!/Opportunity|Research|Evidence|candidate|gate/i.test(text)) errors.push('missing_opportunity_terms');
if (/RegimeLiquidityActionRiskOpportunity/.test(text)) errors.push('concatenated_hero_pills_in_text_read');

report(errors.length ? 'FAILED' : 'OK', errors, {
  mode: 'FINAL_FOUR_SECTION_VALIDATION',
  topbar_count: topbarCount,
  main_nav_count: mainNavCount,
  brand_text_count: brandCount,
  section_counts: sectionCounts,
  forbidden_present: forbiddenPresent,
  visible_not_available_count: visibleNotAvailable,
  zone_cards: zoneCards,
  text_sample: text.slice(0, 600),
});

if (errors.length) {
  console.error(`Homepage web-read validation failed: ${errors.join('; ')}`);
  process.exit(1);
}

console.log(`Homepage web-read validation OK: four sections, ${zoneCards} zone cards`);
console.log(`Wrote ${path.relative(root, reportPath)}`);
