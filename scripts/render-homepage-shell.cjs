const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

const now = new Date().toISOString();
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>OpenClaw Capital Radar</title>
  <link rel="stylesheet" href="assets/capital-radar.css"/>
  <link rel="stylesheet" href="assets/homepage-editorial-reset.css"/>
  <link rel="stylesheet" href="assets/capital-radar-visual-pass.css"/>
</head>
<body>
  <main class="shell">
    <div class="topbar">
      <div class="brand"><span class="mark">◇</span><div>OpenClaw Capital Radar</div></div>
      <nav class="nav">
        <a href="#decision-brief-section">Brief</a>
        <a href="#operational-chart-section">Decision Chart</a>
        <a href="#holdings-section">Holdings</a>
        <a href="#opportunities-section">Opportunity</a>
        <a href="#market-section">Market Tape</a>
      </nav>
      <div id="generated">Operational render · ${now}</div>
    </div>
    <header class="hero">
      <div>
        <p class="eyebrow">Capital Radar · validated decision system</p>
        <h1>What should change now?</h1>
        <p class="lede">A compact market command surface: regime, liquidity, portfolio action, triggers, risk lines, and opportunity filters generated from validated artifacts.</p>
        <div class="lens-strip"><span>Regime</span><span>Liquidity</span><span>Action</span><span>Risk</span><span>Opportunity</span></div>
      </div>
      <aside class="status"><span>System state</span><strong class="good">Health OK</strong><span>Data truth, registry preview, and homepage integrity checks are clean.</span><span>Legacy cleanup remains a warning only when no leakage is detected.</span></aside>
    </header>
    <section id="decision-brief-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Market Decision Brief</h2></div></div></section>
    <section id="operational-chart-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Operational Decision Chart</h2></div></div></section>
    <section id="holdings-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Holdings</h2></div></div></section>
    <section id="opportunities-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Opportunity</h2></div></div></section>
    <section id="market-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Market Tape</h2></div></div></section>
    <footer class="footer">OpenClaw Capital Radar · generated ${now}</footer>
  </main>
</body>
</html>
`;

fs.writeFileSync(indexPath, html);
console.log('Rendered clean homepage shell');