const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'assets', 'capital-radar.css'), 'utf8');
let js = fs.readFileSync(path.join(root, 'public', 'assets', 'capital-radar.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'public', 'data', 'report-state.live.json'), 'utf8');
js = js
  .replace("const api = '/api/capital-radar';", "const api = null;")
  .replace("const fallback = 'data/report-state.live.json';", "const fallback = null;");
const fetchBlock = "fetch(api).then(r => r.ok ? r.json() : Promise.reject()).catch(()=>fetch(fallback).then(r=>r.json())).then(render).catch(err=>{document.body.innerHTML='<main class=\"shell\"><div class=\"panel\"><h1>Capital Radar</h1><p>Could not load live data.</p><pre>'+esc(err)+'</pre></div></main>'});";
js = js.replace(fetchBlock, 'render(window.__CAPITAL_RADAR_DATA__);');
html = html.replace('<link rel="stylesheet" href="assets/capital-radar.css" />', `<style>\n${css}\n</style>`);
html = html.replace('<script src="assets/capital-radar.js"></script>', `<script>window.__CAPITAL_RADAR_DATA__=${data};</script>\n<script>\n${js}\n</script>`);
const out = path.join(root, 'outputs', 'capital-radar-standalone.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out);
