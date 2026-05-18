(function () {
  function normalize(value) { return String(value || '').toLowerCase().trim(); }

  function ensureSearch() {
    if (document.querySelector('.oc-search')) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;

    const wrap = document.createElement('div');
    wrap.className = 'oc-search';
    wrap.innerHTML = '<label class="oc-search-label" for="oc-search-input">Search</label><input id="oc-search-input" type="search" placeholder="Search tickers, signals, risks…" autocomplete="off"><div class="oc-search-results" aria-live="polite"></div>';
    topbar.insertAdjacentElement('afterend', wrap);

    const input = wrap.querySelector('input');
    const results = wrap.querySelector('.oc-search-results');

    input.addEventListener('input', function () {
      const query = normalize(input.value);
      document.body.classList.toggle('is-searching', Boolean(query));
      const cards = Array.from(document.querySelectorAll('#holdings .card, #opportunities .card, .board-card, .force, .source'));
      let matches = [];

      cards.forEach(function (card) {
        const hit = !query || normalize(card.textContent).includes(query);
        card.style.display = hit ? '' : 'none';
        if (query && hit && matches.length < 8) {
          const ticker = card.querySelector('.ticker b');
          const heading = card.querySelector('h3, b, span');
          matches.push({ label: (ticker || heading || card).textContent.trim().slice(0, 64), node: card });
        }
      });

      if (!query) {
        results.innerHTML = '';
        return;
      }

      results.innerHTML = matches.length ? matches.map(function (m, i) {
        return '<button type="button" data-index="' + i + '">' + m.label + '</button>';
      }).join('') : '<span>No visible matches</span>';

      Array.from(results.querySelectorAll('button')).forEach(function (button) {
        button.addEventListener('click', function () {
          const match = matches[Number(button.dataset.index)];
          if (match && match.node) match.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      });
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.blur();
      }
    });
  }

  window.addEventListener('load', ensureSearch);
  setTimeout(ensureSearch, 400);
})();
