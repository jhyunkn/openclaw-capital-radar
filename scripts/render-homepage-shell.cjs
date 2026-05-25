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
        <a href="#data-refresh-section">Trust</a>
        <a href="#kostolany-egg-section">Egg</a>
        <a href="#operational-chart-section">Levels</a>
        <a href="#market-lens-section">Movement</a>
        <a href="#strategy-routing-section">Route</a>
        <a href="#holdings-section">Holdings</a>
        <a href="#opportunities-section">Opportunities</a>
      </nav>
      <div id="generated">Operational render · ${now}</div>
    </div>
    <header class="hero">
      <div>
        <p class="eyebrow">Capital Radar · evidence-first command surface</p>
        <h1>Trust the sources before the strategy.</h1>
        <p class="lede">A decision cockpit that shows data freshness, evidence gaps, permission blockers, regime, portfolio action, and invalidation before turning signals into strategy.</p>
        <div class="lens-strip"><span>Freshness</span><span>Evidence</span><span>Permission</span><span>Risk</span><span>Action</span></div>
      </div>
      <aside class="status"><span>Current posture</span><strong class="bad">Research-only</strong><span>Capital action is blocked until source coverage and decision packets are stronger.</span><span>The page now exposes missing evidence instead of hiding it behind confident language.</span></aside>
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