(function () {
  const riskBudget = {
    maxSpeculativeLeveredPct: 5,
    maxSingleNonIndexPct: 15
  };

  const actionableSignals = ['TRIM WATCH', 'EXIT REVIEW'];
  const speculativeKeywords = ['leveraged', 'tactical', 'speculative', 'crypto', 'option'];
  const indexTickers = new Set(['SPY', 'QQQ', 'IWM', 'VOO', 'VTI']);

  function textOf(node) {
    return String(node?.textContent || '').trim();
  }

  function parsePct(text) {
    const match = String(text || '').match(/(-?\d+(?:\.\d+)?)\s*%/);
    return match ? Number(match[1]) : null;
  }

  function isSpeculative(card) {
    const text = textOf(card).toLowerCase();
    return speculativeKeywords.some(keyword => text.includes(keyword));
  }

  function isIndexTicker(ticker) {
    return indexTickers.has(String(ticker || '').toUpperCase());
  }

  function budgetText(card, ticker, signal, weightPct) {
    const parts = [];
    if (isSpeculative(card)) {
      parts.push(`speculative/levered products are capped at ${riskBudget.maxSpeculativeLeveredPct}% of portfolio`);
    }
    if (!isIndexTicker(ticker)) {
      parts.push(`single non-index positions are capped at ${riskBudget.maxSingleNonIndexPct}% of portfolio`);
    }
    const base = parts.length ? parts.join('; ') : `single non-index positions are capped at ${riskBudget.maxSingleNonIndexPct}% of portfolio`;
    const weight = Number.isFinite(weightPct) ? ` Current displayed weight: ${weightPct.toFixed(2)}%.` : '';
    return `${signal} risk-budget check: ${base}.${weight}`;
  }

  function enhanceCard(card) {
    const signalNode = card.querySelector('.signal');
    const signal = textOf(signalNode).toUpperCase();
    if (!actionableSignals.some(item => signal.includes(item))) return;
    if (card.querySelector('[data-risk-budget-note]')) return;

    const ticker = textOf(card.querySelector('.ticker b'));
    const weightRow = Array.from(card.querySelectorAll('.row')).find(row => /weight/i.test(textOf(row.querySelector('span'))));
    const weightPct = parsePct(textOf(weightRow));
    const note = document.createElement('p');
    note.className = 'risk-budget-note';
    note.dataset.riskBudgetNote = 'true';
    note.textContent = budgetText(card, ticker, signal.includes('EXIT REVIEW') ? 'EXIT REVIEW' : 'TRIM WATCH', weightPct);

    const rationale = Array.from(card.querySelectorAll('p')).find(p => !p.closest('.holding-thesis'));
    if (rationale) {
      rationale.insertAdjacentElement('afterend', note);
    } else {
      card.appendChild(note);
    }
  }

  function init() {
    document.querySelectorAll('#holdings .card, #holdings-section .card').forEach(enhanceCard);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
