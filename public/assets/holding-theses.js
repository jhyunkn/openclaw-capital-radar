(function () {
  const STORAGE_KEY = 'openclaw.capitalRadar.holdingTheses.v1';
  const requiredTickers = new Set(['BMNR', 'TSNF']);

  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_) {
      return {};
    }
  }

  function writeStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function updateCard(card, ticker, value) {
    const warning = card.querySelector('[data-thesis-warning]');
    const status = card.querySelector('[data-thesis-status]');
    const isRequired = requiredTickers.has(ticker);
    const hasValue = value.trim().length > 0;

    if (warning) warning.hidden = !(isRequired && !hasValue);
    if (status) status.textContent = hasValue ? 'Saved locally' : 'Empty';
  }

  function init() {
    const store = readStore();
    document.querySelectorAll('[data-thesis-card]').forEach(card => {
      const ticker = card.dataset.thesisTicker;
      const input = card.querySelector('[data-thesis-input]');
      if (!ticker || !input) return;

      input.value = store[ticker] || '';
      updateCard(card, ticker, input.value);

      input.addEventListener('input', () => {
        const next = readStore();
        next[ticker] = input.value;
        writeStore(next);
        updateCard(card, ticker, input.value);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
