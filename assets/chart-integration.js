(function () {
  const workspaceUrl = ticker => ticker ? `pages/${String(ticker).toLowerCase()}.html` : 'outputs/capital-radar-current.html#holdings';
  const makeLink = (href, text, className = 'button') => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.className = className;
    return a;
  };

  function integrateGlobalEntry() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('[data-ticker-workspace-link]')) {
      const a = makeLink(workspaceUrl(), 'Ticker workspaces', '');
      a.dataset.tickerWorkspaceLink = 'true';
      nav.appendChild(a);
    }

    const lens = document.querySelector('.lens-strip');
    if (lens && !lens.querySelector('[data-ticker-workspace-link]')) {
      const span = document.createElement('span');
      const a = makeLink(workspaceUrl(), 'Ticker workspaces', '');
      a.dataset.tickerWorkspaceLink = 'true';
      span.appendChild(a);
      lens.appendChild(span);
    }

    const decisionHead = document.querySelector('.section-head');
    if (decisionHead && !decisionHead.querySelector('[data-ticker-workspace-button]')) {
      const wrap = decisionHead.querySelector('div[style]') || decisionHead;
      const a = makeLink(workspaceUrl(), 'Ticker workspaces', 'button');
      a.dataset.tickerWorkspaceButton = 'true';
      wrap.appendChild(a);
    }
  }

  function extractTicker(card) {
    const detail = card.querySelector('a[href^="pages/"]');
    if (detail) {
      const match = detail.getAttribute('href').match(/pages\/([^/.]+)\.html/i);
      if (match) return match[1].toUpperCase();
    }
    const bold = card.querySelector('.ticker b');
    return bold ? bold.textContent.trim().toUpperCase() : '';
  }

  function integrateHoldingCards() {
    document.querySelectorAll('#holdings .card').forEach(card => {
      const ticker = extractTicker(card);
      if (!ticker) return;
      const existingDetail = card.querySelector('a.detail-link[href^="pages/"]');
      if (existingDetail) {
        existingDetail.textContent = `Open ${ticker} rating + chart →`;
        existingDetail.dataset.tickerWorkspaceCardLink = 'true';
        return;
      }
      if (card.querySelector('[data-ticker-workspace-card-link]')) return;
      const a = makeLink(workspaceUrl(ticker), `Open ${ticker} rating + chart →`, 'detail-link');
      a.dataset.tickerWorkspaceCardLink = 'true';
      card.appendChild(a);
    });
  }

  function integrate() {
    integrateGlobalEntry();
    integrateHoldingCards();
  }

  const observer = new MutationObserver(integrate);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', integrate);
  setTimeout(integrate, 300);
  setTimeout(integrate, 1200);
})();
