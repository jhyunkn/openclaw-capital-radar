(function () {
  const chartUrl = ticker => `outputs/chart-cognition.html${ticker ? `?symbol=${encodeURIComponent(ticker)}` : ''}`;
  const makeLink = (href, text, className = 'button') => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.className = className;
    return a;
  };

  function integrateGlobalEntry() {
    const nav = document.querySelector('.nav');
    if (nav && !nav.querySelector('[data-chart-cognition-link]')) {
      const a = makeLink(chartUrl('SPY'), 'Chart cognition', '');
      a.dataset.chartCognitionLink = 'true';
      nav.appendChild(a);
    }

    const lens = document.querySelector('.lens-strip');
    if (lens && !lens.querySelector('[data-chart-cognition-link]')) {
      const span = document.createElement('span');
      const a = makeLink(chartUrl('SPY'), 'Chart cognition', '');
      a.dataset.chartCognitionLink = 'true';
      span.appendChild(a);
      lens.appendChild(span);
    }

    const decisionHead = document.querySelector('.section-head');
    if (decisionHead && !decisionHead.querySelector('[data-chart-cognition-button]')) {
      const wrap = decisionHead.querySelector('div[style]') || decisionHead;
      const a = makeLink(chartUrl('SPY'), 'Chart cognition', 'button');
      a.dataset.chartCognitionButton = 'true';
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
      if (card.querySelector('[data-live-chart-link]')) return;
      const ticker = extractTicker(card);
      if (!ticker) return;
      const a = makeLink(chartUrl(ticker), 'Open live chart →', 'detail-link');
      a.dataset.liveChartLink = 'true';
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
