(function () {
  const mdUrl = '/outputs/live-capital-radar.md';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function sectionBetween(markdown, startHeading, nextHeadingPattern) {
    const start = markdown.indexOf(startHeading);
    if (start < 0) return '';
    const rest = markdown.slice(start + startHeading.length);
    const next = rest.search(nextHeadingPattern);
    return next >= 0 ? rest.slice(0, next) : rest;
  }

  function subSection(markdown, heading) {
    const pattern = new RegExp('^###\\s+' + heading.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\s*$', 'mi');
    const match = markdown.match(pattern);
    if (!match || match.index == null) return '';
    const rest = markdown.slice(match.index + match[0].length);
    const next = rest.search(/^###\s+/m);
    return next >= 0 ? rest.slice(0, next) : rest;
  }

  function parseMarkdownTable(block) {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line.startsWith('|'));
    if (lines.length < 2) return [];
    const header = lines[0].split('|').slice(1, -1).map(cell => cell.trim());
    return lines.slice(2).map(line => {
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
    }).filter(row => Object.values(row).some(Boolean));
  }

  function parseBullets(block) {
    const out = {};
    block.split('\n').forEach(line => {
      const match = line.match(/^[-*]\s*\*\*([^:*]+):\*\*\s*(.*)$/) || line.match(/^[-*]\s*([^:]+):\s*(.*)$/);
      if (match) out[match[1].trim()] = match[2].trim();
    });
    return out;
  }

  function parseParagraphValue(block, label) {
    const rx = new RegExp('(?:^|\\n)(?:[-*]\\s*)?\\*\\*' + label + ':\\*\\*\\s*([^\\n]+)', 'i');
    const match = block.match(rx);
    return match ? match[1].trim() : '';
  }

  function valueTone(value) {
    const text = String(value || '').replace(/[%+,]/g, '');
    const num = Number(text);
    if (!Number.isFinite(num)) return '';
    if (num > 0) return 'good';
    if (num < 0) return 'bad';
    return '';
  }

  function renderTable(rows, columns, options = {}) {
    if (!rows.length) return '<p class="muted">No markdown rows found.</p>';
    return `<div class="table-wrap"><table class="table"><thead><tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => {
      const value = row[c.key] ?? row[c.alt] ?? '';
      const cls = c.tone ? valueTone(value) : '';
      return `<td class="${cls}">${esc(value)}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderRegime(regime) {
    const keys = ['Posture', 'Growth', 'Inflation', 'Policy', 'Liquidity', 'Risk appetite', 'Most important macro signal', 'Confidence'];
    return `<div class="market-regime-strip">${keys.map(key => `<article class="market-pill"><span>${esc(key)}</span><b>${esc(regime[key] || regime[key.toLowerCase()] || '—')}</b></article>`).join('')}</div>`;
  }

  function renderRates(rows) {
    const desired = ['DGS2', 'DGS10', 'DGS30', 'T10YIE', 'BAMLH0A0HYM2', 'BAMLC0A0CM', 'FEDFUNDS'];
    const filtered = desired.map(id => rows.find(row => row.Series === id || row.series === id)).filter(Boolean);
    const useRows = filtered.length ? filtered : rows;
    return `<div class="rates-strip">${useRows.map(row => `<article class="rate-card"><span>${esc(row.Series || row.series || '—')}</span><b>${esc(row.Value || row.value || '—')}</b><small>${esc(row.Name || row.name || '')}<br>${esc(row['Latest date'] || row.latestDate || '')}</small></article>`).join('')}</div>`;
  }

  function renderCycle(block) {
    const phase = parseParagraphValue(block, 'Phase') || (block.match(/Phase\s*[:—-]\s*([^\n]+)/i)?.[1] || '').trim();
    const evidence = parseParagraphValue(block, 'Evidence') || (block.match(/Evidence\s*[:—-]\s*([^\n]+)/i)?.[1] || '').trim();
    const cleaned = block.replace(/^##.*$/gm, '').trim();
    return `<article class="kostolany-callout"><span>Kostolany cycle position</span><h3>${esc(phase || 'Phase not found')}</h3><p>${esc(evidence || cleaned || 'Evidence not found in markdown.')}</p></article>`;
  }

  async function populateMarketSection() {
    const section = document.getElementById('market-section');
    const marketDiv = document.getElementById('market');
    const marketTable = document.getElementById('market-table');
    const ratesTable = document.getElementById('rates-table');
    if (!section || !marketDiv || !marketTable || !ratesTable) return;

    try {
      const res = await fetch(mdUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Markdown fetch failed: ${res.status}`);
      const markdown = await res.text();
      const appendix = sectionBetween(markdown, '## Evidence Appendix', /^##\s+/m) || markdown;
      const marketTape = parseMarkdownTable(subSection(appendix, 'Market tape'));
      const rates = parseMarkdownTable(subSection(appendix, 'Rates / credit / liquidity'));
      const regimeBlock = sectionBetween(markdown, '## 1. Market Regime', /^##\s+2\./m);
      const cycleBlock = sectionBetween(markdown, '## 2. Kostolany Cycle Position', /^##\s+3\./m);
      const regime = parseBullets(regimeBlock);

      marketDiv.innerHTML = [
        '<div class="market-md-stack">',
        '<section class="market-md-block"><div class="section-head compact"><div><p class="eyebrow">Regime</p><h3>Market Regime</h3></div></div>',
        renderRegime(regime),
        '</section>',
        '<section class="market-md-block">',
        renderCycle(cycleBlock),
        '</section>',
        '</div>'
      ].join('');

      marketTable.innerHTML = '<div class="section-head compact"><div><p class="eyebrow">Evidence Appendix</p><h3>Market Tape</h3></div></div>' + renderTable(marketTape, [
        { key: 'Symbol', label: 'Symbol' },
        { key: 'Price', label: 'Price' },
        { key: 'Day%', label: 'Day%', tone: true },
        { key: '5D%', label: '5D%' },
        { key: '1M%', label: '1M%' },
        { key: '3M%', label: '3M%' },
        { key: 'As of', label: 'As of' }
      ]);

      ratesTable.innerHTML = '<div class="section-head compact"><div><p class="eyebrow">Rates / Credit / Liquidity</p><h3>Macro pressure strip</h3></div></div>' + renderRates(rates);
    } catch (error) {
      marketDiv.innerHTML = `<p class="muted">Could not populate market section from markdown: ${esc(error.message)}</p>`;
    }
  }

  window.addEventListener('load', populateMarketSection);
  setTimeout(populateMarketSection, 800);
})();
