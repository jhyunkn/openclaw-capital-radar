(() => {
  const svgNS = 'http://www.w3.org/2000/svg';
  const rows = [
    ['ke-callout-defense', 142, 112, 'Defense', 'cash · TLT · gold'],
    ['ke-callout-growth', 738, 112, 'Recovery / growth', 'SPX · quality growth'],
    ['ke-callout-risk', 738, 518, 'Excess risk', 'small caps · crypto beta'],
    ['ke-callout-trim', 142, 518, 'Distribution', 'trim beta · raise cash'],
  ];

  function makeText(x, y, title, ticker) {
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'egg-quadrant-label');

    const titleSpan = document.createElementNS(svgNS, 'tspan');
    titleSpan.setAttribute('x', String(x));
    titleSpan.setAttribute('dy', '0');
    titleSpan.setAttribute('class', 'egg-quadrant-title');
    titleSpan.textContent = title;

    const tickerSpan = document.createElementNS(svgNS, 'tspan');
    tickerSpan.setAttribute('x', String(x));
    tickerSpan.setAttribute('dy', '1.4em');
    tickerSpan.setAttribute('class', 'egg-quadrant-ticker');
    tickerSpan.textContent = ticker;

    text.append(titleSpan, tickerSpan);
    return text;
  }

  function patchEggCallouts() {
    const root = document.querySelector('#kostolany-egg-section');
    if (!root) return;
    for (const [klass, x, y, title, ticker] of rows) {
      const group = root.querySelector(`.${klass}`);
      if (!group || group.dataset.stacked === 'true') continue;
      while (group.firstChild) group.removeChild(group.firstChild);
      group.appendChild(makeText(x, y, title, ticker));
      group.dataset.stacked = 'true';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchEggCallouts, { once: true });
  } else {
    patchEggCallouts();
  }
  window.addEventListener('load', patchEggCallouts, { once: true });
})();
