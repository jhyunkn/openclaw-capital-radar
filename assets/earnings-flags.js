(function () {
  const dataSources = [
    '/data/report-state.live.json',
    'data/report-state.live.json',
    '/data/report-state.sample.json',
    'data/report-state.sample.json'
  ];

  function text(value) {
    return String(value ?? '').trim();
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function nextEarningsDate(holding) {
    return parseDate(
      holding?.nextEarningsDate ||
      holding?.earningsDate ||
      holding?.finviz?.metrics?.['Earnings'] ||
      holding?.finviz?.metrics?.['Earnings Date']
    );
  }

  function tradingDaysUntil(target) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    if (target < today) return null;
    let days = 0;
    const cursor = new Date(today);
    while (cursor < target) {
      cursor.setDate(cursor.getDate() + 1);
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) days += 1;
    }
    return days;
  }

  async function loadState() {
    for (const url of dataSources) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        return await res.json();
      } catch (_) {}
    }
    return null;
  }

  function render(state) {
    const holdings = Object.fromEntries((state?.holdings || []).map(h => [text(h.ticker).toUpperCase(), h]));
    document.querySelectorAll('[data-thesis-card]').forEach(card => {
      if (card.querySelector('[data-earnings-flag]')) return;
      const ticker = text(card.dataset.thesisTicker).toUpperCase();
      const holding = holdings[ticker];
      const date = nextEarningsDate(holding);
      if (!date) return;
      const days = tradingDaysUntil(date);
      if (!Number.isFinite(days) || days > 5) return;
      const flag = document.createElement('span');
      flag.className = 'earnings-flag';
      flag.dataset.earningsFlag = 'true';
      flag.textContent = `⚠ Earnings in ${days} trading day${days === 1 ? '' : 's'}`;
      const signal = card.querySelector('.signal');
      if (signal) signal.insertAdjacentElement('afterend', flag);
      else card.prepend(flag);
    });
  }

  loadState().then(render);
})();
