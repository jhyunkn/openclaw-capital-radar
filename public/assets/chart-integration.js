(function () {
  const workspaceUrl = ticker => ticker ? `pages/${String(ticker).toLowerCase()}.html` : 'outputs/capital-radar-current.html#holdings';

  function extractTicker(card) {
    const detail = card.querySelector('a[href*="pages/"]');
    if (detail) {
      const match = detail.getAttribute('href').match(/pages\/([^/.]+)\.html/i);
      if (match) return match[1].toUpperCase();
    }
    const bold = card.querySelector('.ticker b');
    return bold ? bold.textContent.trim().toUpperCase() : '';
  }

  function normalizeHoldingLinks() {
    document.querySelectorAll('#holdings .card, #holdings .holding').forEach(card => {
      const ticker = extractTicker(card);
      if (!ticker) return;
      const links = Array.from(card.querySelectorAll('a.detail-link, a[href*="chart-cognition"], a[href*="pages/"]'));
      const canonical = links.find(a => a.getAttribute('href') && a.getAttribute('href').includes('/pages/')) || links[0];
      if (!canonical) return;
      canonical.href = workspaceUrl(ticker);
      canonical.textContent = `Open ${ticker} rating + chart →`;
      canonical.className = canonical.className || 'detail-link';
      canonical.dataset.tickerWorkspaceCardLink = 'true';
      links.forEach(a => { if (a !== canonical) a.remove(); });
    });
  }

  function integrateGlobalEntry() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('[data-ticker-workspace-link]')) {
      const a = document.createElement('a');
      a.href = workspaceUrl();
      a.textContent = 'Ticker workspaces';
      a.dataset.tickerWorkspaceLink = 'true';
      nav.appendChild(a);
    }
  }

  function integrate() {
    integrateGlobalEntry();
    normalizeHoldingLinks();
  }

  const observer = new MutationObserver(integrate);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', integrate);
  setTimeout(integrate, 100);
  setTimeout(integrate, 500);
  setTimeout(integrate, 1500);
})();
