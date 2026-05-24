const fs = require('fs');
const path = require('path');
const { getHomepageSectionRegistry, root } = require('./homepage-section-registry.cjs');

const manifestPath = path.join(root, 'config', 'homepage-sections.json');
const outputsDir = path.join(root, 'outputs');
const htmlPath = path.join(outputsDir, 'homepage-registry-preview.html');
const reportPath = path.join(outputsDir, 'homepage-registry-preview-report.json');

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function existsJson(relativePath) {
  const filePath = path.join(root, relativePath);
  return fs.existsSync(filePath) ? { exists: true, value: readJson(filePath) } : { exists: false, value: null };
}
function countId(html, id) {
  const safe = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (html.match(new RegExp(`id=["']${safe}["']`, 'g')) || []).length;
}
function previewHref(href) {
  const value = String(href || '');
  if (!value || value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')) return value;
  return `../${value.replace(/^\.\//, '')}`;
}
function loadState(definition, diagnostics) {
  const primary = existsJson(definition.path);
  if (primary.exists) {
    diagnostics.stateSources.push({ key: definition.key, path: definition.path, source: 'primary' });
    return primary.value;
  }
  if (typeof definition.fallback === 'string') {
    const fallback = existsJson(definition.fallback);
    if (fallback.exists) {
      diagnostics.stateSources.push({ key: definition.key, path: definition.path, source: 'fallback', fallback: definition.fallback });
      diagnostics.fallbackStates.push({ key: definition.key, requestedPath: definition.path, fallbackPath: definition.fallback });
      return fallback.value;
    }
  }
  if (definition.fallback && typeof definition.fallback === 'object') {
    diagnostics.stateSources.push({ key: definition.key, path: definition.path, source: 'inline-fallback' });
    diagnostics.fallbackStates.push({ key: definition.key, requestedPath: definition.path, fallback: 'inline' });
    return definition.fallback;
  }
  diagnostics.missingStates.push({ key: definition.key, path: definition.path, required: definition.required !== false });
  return undefined;
}
function loadRenderer(entry, diagnostics) {
  const spec = entry.renderer || {};
  if (!spec.path) {
    diagnostics.missingRenderers.push({ reason: 'registry renderer path missing' });
    return null;
  }
  const rendererPath = path.join(root, spec.path);
  if (!fs.existsSync(rendererPath)) {
    diagnostics.missingRenderers.push({ path: spec.path, reason: 'file missing' });
    return null;
  }
  try {
    const mod = require(rendererPath);
    const section = mod[spec.sectionExport];
    const style = spec.styleExport ? mod[spec.styleExport] : null;
    if (typeof section !== 'function') {
      diagnostics.missingRenderers.push({ path: spec.path, export: spec.sectionExport, reason: 'section export missing' });
      return null;
    }
    if (spec.styleExport && typeof style !== 'function') {
      diagnostics.missingRenderers.push({ path: spec.path, export: spec.styleExport, reason: 'style export missing' });
    }
    return { section, style: typeof style === 'function' ? style : null };
  } catch (error) {
    diagnostics.missingRenderers.push({ path: spec.path, reason: `require failed: ${error.message}` });
    return null;
  }
}
function fallbackSection(entry, title, detail) {
  return `<section id="${esc(entry.id)}" class="panel registry-preview-gap"><div class="section-head"><div><p class="eyebrow">Registry preview gap</p><h2>${esc(title)}</h2></div></div><p>${esc(detail)}</p></section>`;
}
function renderEntry(entry) {
  const diagnostics = {
    id: entry.id,
    manifestId: entry.manifestId || entry.id,
    renderer: entry.renderer || null,
    stateSources: [],
    missingStates: [],
    fallbackStates: [],
    missingRenderers: [],
    renderPermission: 'unknown',
    status: 'PENDING',
    error: null,
  };
  const states = {};
  for (const definition of entry.states || []) states[definition.key] = loadState(definition, diagnostics);
  const requiredMissing = diagnostics.missingStates.filter(item => item.required);
  if (requiredMissing.length) {
    diagnostics.status = 'MISSING_REQUIRED_STATE';
    return { entry, diagnostics, section: fallbackSection(entry, entry.navLabel || entry.id, `Missing required state: ${requiredMissing.map(item => item.path).join(', ')}`), style: '' };
  }
  const primaryState = states.state || states.zoneState;
  if (primaryState && primaryState.render_permission === false) {
    diagnostics.renderPermission = false;
    diagnostics.status = 'RENDER_PERMISSION_FALSE';
    return { entry, diagnostics, section: fallbackSection(entry, entry.navLabel || entry.id, 'State render_permission=false.'), style: '' };
  }
  diagnostics.renderPermission = primaryState && Object.prototype.hasOwnProperty.call(primaryState, 'render_permission') ? primaryState.render_permission : 'not-declared';
  const renderer = loadRenderer(entry, diagnostics);
  if (!renderer) {
    diagnostics.status = 'MISSING_RENDERER';
    return { entry, diagnostics, section: fallbackSection(entry, entry.navLabel || entry.id, 'Renderer module or export missing.'), style: '' };
  }
  try {
    const args = typeof entry.buildArgs === 'function' ? entry.buildArgs({ states, entry }) : [primaryState];
    const section = renderer.section(...args);
    const style = renderer.style ? renderer.style() : '';
    diagnostics.status = 'OK';
    return { entry, diagnostics, section: String(section || ''), style: String(style || '') };
  } catch (error) {
    diagnostics.status = 'RENDER_ERROR';
    diagnostics.error = error.stack || error.message;
    return { entry, diagnostics, section: fallbackSection(entry, entry.navLabel || entry.id, `Render error: ${error.message}`), style: '' };
  }
}
function buildHtml({ manifest, rendered, styles, cssLinks }) {
  const generatedAt = new Date().toISOString();
  const nav = rendered.map(({ entry }) => `<a href="#${esc(entry.id)}">${esc(entry.navLabel || entry.id)}</a>`).join('');
  const links = ['assets/capital-radar.css', 'assets/homepage-editorial-reset.css', ...cssLinks]
    .filter(Boolean).filter((value, index, array) => array.indexOf(value) === index)
    .map(href => `<link rel="stylesheet" href="${esc(previewHref(href))}"/>`).join('\n  ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>OpenClaw Capital Radar · Registry Preview</title>
  ${links}
  <style>.registry-preview-banner{margin:18px 0 0;padding:12px 14px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.045);font-size:12px;letter-spacing:.02em}.registry-preview-gap{border-color:rgba(255,184,77,.45)!important;background:rgba(255,184,77,.06)!important}</style>
  ${styles.join('\n  ')}
</head>
<body>
  <main class="shell">
    <div class="topbar"><div class="brand"><span class="mark">◇</span><div>OpenClaw Capital Radar</div></div><nav class="nav">${nav}</nav><div id="generated">Registry preview · ${esc(generatedAt)}</div></div>
    <header class="hero"><div><p class="eyebrow">Capital Radar · non-authoritative registry preview</p><h1>Homepage section registry preview</h1><p class="lede">This file renders active manifest sections through a standalone registry snapshot without replacing production index.html or invoking legacy cleanup commands.</p><div class="lens-strip"><span>Registry</span><span>State</span><span>Renderer</span><span>Validation</span></div><div class="registry-preview-banner">Manifest v${esc(manifest.version || 'unknown')} · production output untouched · generated from existing state artifacts only.</div></div><aside class="status"><span>Preview authority</span><strong class="good">Non-production</strong><span>Use outputs/homepage-registry-preview-report.json to decide when registry migration is safe.</span><span>Existing injectors and cleanup scripts remain authoritative for production.</span></aside></header>
    ${rendered.map(item => item.section).join('\n    ')}
    <footer class="footer">OpenClaw Capital Radar · registry preview generated ${esc(generatedAt)}</footer>
  </main>
</body>
</html>
`;
}
function validate({ html, manifest, registry, rendered }) {
  const activeIds = manifest.sections.filter(section => section.enabled !== false).map(section => section.id);
  const disabledIds = manifest.sections.filter(section => section.enabled === false).map(section => section.id);
  const representedIds = registry.map(entry => entry.manifestId || entry.id);
  const sectionCounts = activeIds.map(id => ({ id, count: countId(html, id), expected: 1 }));
  const report = {
    allActiveManifestSectionsRepresented: activeIds.every(id => representedIds.includes(id)),
    activeManifestSections: activeIds,
    registryRenderOrder: registry.map(entry => entry.id),
    representedManifestSections: representedIds,
    missingManifestSections: activeIds.filter(id => !representedIds.includes(id)),
    unexpectedRegistrySections: representedIds.filter(id => !activeIds.includes(id)),
    sectionCounts,
    sectionCountMismatches: sectionCounts.filter(item => item.count !== item.expected),
    duplicateSections: sectionCounts.filter(item => item.count > 1),
    legacySectionLeakage: (manifest.cleanup?.legacySectionIds || []).map(id => ({ id, count: countId(html, id) })).filter(item => item.count > 0),
    disabledSectionLeakage: disabledIds.map(id => ({ id, count: countId(html, id) })).filter(item => item.count > 0),
    bannedPhraseLeakage: (manifest.cleanup?.bannedPhrases || []).filter(phrase => html.toLowerCase().includes(String(phrase).toLowerCase())),
    objectObjectLeakage: html.includes('[object Object]'),
    missingStates: rendered.flatMap(item => item.diagnostics.missingStates.map(state => ({ section: item.entry.id, ...state }))),
    missingRenderers: rendered.flatMap(item => item.diagnostics.missingRenderers.map(renderer => ({ section: item.entry.id, ...renderer }))),
    renderGaps: rendered.filter(item => item.diagnostics.status !== 'OK').map(item => ({ id: item.entry.id, status: item.diagnostics.status, error: item.diagnostics.error })),
  };
  const blocking = report.missingManifestSections.length + report.sectionCountMismatches.length + report.legacySectionLeakage.length + report.disabledSectionLeakage.length + report.bannedPhraseLeakage.length + report.renderGaps.length + (report.objectObjectLeakage ? 1 : 0);
  return { status: blocking === 0 ? 'OK' : 'PREVIEW_WITH_GAPS', ...report };
}
function main() {
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing homepage manifest: ${path.relative(root, manifestPath)}`);
  const manifest = readJson(manifestPath);
  const activeIds = new Set(manifest.sections.filter(section => section.enabled !== false).map(section => section.id));
  const registry = getHomepageSectionRegistry().filter(entry => activeIds.has(entry.manifestId || entry.id)).sort((a, b) => Number(a.previewOrder || 999) - Number(b.previewOrder || 999));
  const rendered = registry.map(renderEntry);
  const html = buildHtml({ manifest, rendered, styles: rendered.map(item => item.style).filter(Boolean), cssLinks: registry.flatMap(entry => entry.cssLinks || []) });
  const validation = validate({ html, manifest, registry, rendered });
  const report = {
    generatedAt: new Date().toISOString(),
    status: validation.status,
    policy: 'non-authoritative homepage registry preview; production index.html is not read or written',
    productionIndexWritten: false,
    manifest: path.relative(root, manifestPath),
    outputs: { html: path.relative(root, htmlPath), report: path.relative(root, reportPath) },
    validation,
    sections: rendered.map(item => item.diagnostics),
  };
  fs.mkdirSync(outputsDir, { recursive: true });
  fs.writeFileSync(htmlPath, html);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Homepage registry preview ${validation.status}`);
  console.log(`Wrote ${path.relative(root, htmlPath)}`);
  console.log(`Wrote ${path.relative(root, reportPath)}`);
  if (process.argv.includes('--strict') && validation.status !== 'OK') process.exit(1);
}
main();
