const CANONICAL_SECTION_IDS = {
  macro: 'decision-brief-section',
  chart: 'operational-chart-section',
  holdings: 'holdings-section',
  opportunity: 'opportunities-section',
};

const SECTION_ALIASES = {
  macro: [CANONICAL_SECTION_IDS.macro, 'brief'],
  chart: [CANONICAL_SECTION_IDS.chart],
  holdings: [CANONICAL_SECTION_IDS.holdings, 'holdings'],
  opportunity: [CANONICAL_SECTION_IDS.opportunity, 'opportunity'],
};

const REQUIRED_SECTION_ORDER = [
  CANONICAL_SECTION_IDS.macro,
  CANONICAL_SECTION_IDS.chart,
  CANONICAL_SECTION_IDS.holdings,
  CANONICAL_SECTION_IDS.opportunity,
];

function sectionId(role) {
  return CANONICAL_SECTION_IDS[role] || role;
}

function sectionAliases(role) {
  return SECTION_ALIASES[role] || [sectionId(role)];
}

function hasSection(html, role) {
  const text = String(html || '');
  return sectionAliases(role).some(id => text.includes(`id="${id}"`) || text.includes(`id='${id}'`));
}

function sectionIds(html) {
  return [...String(html || '').matchAll(/<section\s+id="([^"]+)"/g)].map(match => match[1]);
}

function hasFourSectionSurface(html) {
  const ids = sectionIds(html);
  const canonical = JSON.stringify(ids) === JSON.stringify(REQUIRED_SECTION_ORDER);
  const preShipCompressed = hasSection(html, 'macro') && hasSection(html, 'holdings') && hasSection(html, 'opportunity');
  return canonical || preShipCompressed;
}

function sectionHtml(html, role) {
  const text = String(html || '');
  for (const id of sectionAliases(role)) {
    const match = text.match(new RegExp(`<section[^>]*id=["']${id}["'][\\s\\S]*?<\\/section>`, 'i'));
    if (match) return match[0];
  }
  return '';
}

module.exports = {
  CANONICAL_SECTION_IDS,
  REQUIRED_SECTION_ORDER,
  SECTION_ALIASES,
  hasFourSectionSurface,
  hasSection,
  sectionHtml,
  sectionAliases,
  sectionId,
  sectionIds,
};
