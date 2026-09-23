(() => {
  const root = document.getElementById('mandate-command');
  if (!root) return;
  const tabs = [...root.querySelectorAll('[data-mandate-tab]')];
  const panels = [...root.querySelectorAll('[data-mandate-panel]')];
  const allowed = new Set(tabs.map(tab => tab.dataset.mandateTab));
  const activate = id => {
    const selected = allowed.has(id) ? id : root.dataset.defaultMandate;
    tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.mandateTab === selected)));
    panels.forEach(panel => { panel.hidden = panel.dataset.mandatePanel !== selected; });
    try { localStorage.setItem('capital-radar-mandate', selected); } catch {}
  };
  tabs.forEach(tab => tab.addEventListener('click', () => activate(tab.dataset.mandateTab)));
  let saved = null;
  try { saved = localStorage.getItem('capital-radar-mandate'); } catch {}
  activate(saved || root.dataset.defaultMandate || 'core');
})();
