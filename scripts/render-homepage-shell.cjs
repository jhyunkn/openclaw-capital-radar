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
        <a href="#decision-brief-section">Macro</a>
        <a href="#operational-chart-section">Decision chart</a>
        <a href="#holdings-section">Holdings</a>
        <a href="#opportunities-section">Opportunity</a>
      </nav>
      <div id="generated">Operational render · ${now}</div>
    </div>
    <header class="hero">
      <div>
        <p class="eyebrow">Capital Radar · four-section decision surface</p>
        <h1>Macro first. Price second. Portfolio third. Opportunity last.</h1>
        <p class="lede">A cleaned investment operating page: Macro sets permission, Decision chart defines levels, Holdings translates exposure, and Opportunity stays a research queue.</p>
        <div class="lens-strip"><span>Macro</span><span>Decision chart</span><span>Holdings</span><span>Opportunity</span></div>
      </div>
      <aside class="status"><span>Current surface</span><strong class="good">Four sections</strong><span>Supporting diagnostics are inputs, not standalone web sections.</span><span>Every visible block should support action, invalidation, or evidence quality.</span></aside>
    </header>
    <section id="decision-brief-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Macro</h2></div></div></section>
    <section id="operational-chart-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Decision chart</h2></div></div></section>
    <section id="holdings-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Holdings</h2></div></div></section>
    <section id="opportunities-section" class="panel"><div class="section-head"><div><p class="eyebrow">Loading</p><h2>Opportunity</h2></div></div></section>
    <footer class="footer">OpenClaw Capital Radar · generated ${now}</footer>
  </main>
</body>
</html>
`;

fs.writeFileSync(indexPath, html);
console.log('Rendered four-section homepage shell');
