const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');

// Visual v3: preserve data/markup from the egg injector, but impose a calmer two-color investor-grade system.
const css=`<style id="kostolany-egg-v3-style">
.kostolany-egg{--ke-green:var(--green,#1f8f4d);--ke-red:var(--red,#c9463b);--ke-ink:var(--ink,#1c1b18);--ke-muted:var(--muted,#6f6b63);--ke-panel:rgba(251,250,246,.58);--ke-line:rgba(44,42,37,.14);--ke-soft:rgba(44,42,37,.055);margin-top:22px!important}
.kostolany-egg .egg-command{display:grid!important;grid-template-columns:1fr 280px!important;gap:18px!important;align-items:end!important;border-bottom:1px solid var(--ke-line)!important;padding-bottom:18px!important}
.kostolany-egg .egg-command h2{font-size:clamp(34px,5vw,58px)!important;line-height:1.02!important;letter-spacing:-.045em!important;margin:0!important}
.kostolany-egg .egg-command h2::first-letter{color:var(--ke-green)!important}
.kostolany-egg .egg-sub{color:var(--ke-muted)!important;font-size:13px!important;text-transform:uppercase!important;letter-spacing:.12em!important;margin-top:10px!important}
.kostolany-egg .egg-command-action{border:1px solid var(--ke-line)!important;border-radius:18px!important;background:var(--ke-soft)!important;padding:16px!important}
.kostolany-egg .egg-command-action b{font-size:20px!important;line-height:1.05!important;margin:7px 0!important}
.kostolany-egg .egg-command-action small{color:var(--ke-red)!important;font-size:11px!important;letter-spacing:.07em!important}
.kostolany-egg .egg-v2-grid{display:grid!important;grid-template-columns:1.35fr .9fr!important;gap:18px!important;margin-top:18px!important}
.kostolany-egg .egg-map,.kostolany-egg .egg-readout,.kostolany-egg .egg-tables article{background:var(--ke-panel)!important;border:1px solid var(--ke-line)!important;border-radius:24px!important;padding:18px!important;box-shadow:none!important}
.kostolany-egg .egg-map svg{max-width:100%!important;width:100%!important;height:auto!important}
.kostolany-egg .egg-shell{fill:rgba(251,250,246,.78)!important;stroke:var(--ke-line)!important;stroke-width:2!important}
.kostolany-egg .egg-ring{fill:none!important;stroke:rgba(28,27,24,.36)!important;stroke-width:2.4!important;stroke-dasharray:9 7!important}
.kostolany-egg .phase-tick{stroke:rgba(44,42,37,.16)!important}.kostolany-egg .phase-tick.current{stroke:var(--ke-green)!important;stroke-width:4!important}
.kostolany-egg .egg-node circle{fill:#f7f5ef!important;stroke:var(--ke-line)!important;stroke-width:2!important}
.kostolany-egg .egg-node.current circle{fill:#fbfffc!important;stroke:var(--ke-green)!important;stroke-width:4!important}
.kostolany-egg .egg-node.previous circle,.kostolany-egg .egg-node.next circle{stroke:rgba(44,42,37,.28)!important}
.kostolany-egg .egg-node .code{font-size:20px!important;font-weight:850!important;fill:var(--ke-ink)!important}.kostolany-egg .egg-node.current .code{fill:var(--ke-green)!important}
.kostolany-egg .egg-node .label{font-size:8.5px!important;fill:var(--ke-muted)!important;letter-spacing:.06em!important}
.kostolany-egg .egg-center ellipse{fill:rgba(246,244,238,.95)!important;stroke:var(--ke-line)!important;stroke-width:1.5!important}.kostolany-egg .center-action{font-size:14px!important;font-weight:850!important;fill:var(--ke-ink)!important}.kostolany-egg .center-stress{fill:var(--ke-red)!important}
.kostolany-egg .egg-readout h3,.kostolany-egg .egg-tables h3{font-size:22px!important;letter-spacing:-.02em!important;margin-bottom:14px!important}
.kostolany-egg .egg-read article,.kostolany-egg .prob-strip article,.kostolany-egg .egg-axis article{background:#ffffff!important;border:1px solid rgba(44,42,37,.08)!important;border-radius:16px!important}
.kostolany-egg .egg-read b{font-size:18px!important;line-height:1.22!important}.kostolany-egg .egg-axis{grid-template-columns:1fr!important;gap:10px!important}
.kostolany-egg .egg-axis i,.kostolany-egg .prob-strip i{height:7px!important;color:var(--ke-green)!important;background:linear-gradient(90deg,currentColor var(--w),rgba(44,42,37,.10) var(--w))!important}.kostolany-egg .egg-axis article:nth-child(1) i,.kostolany-egg .egg-axis article:nth-child(5) i{color:var(--ke-red)!important}
.kostolany-egg .egg-tables{display:grid!important;grid-template-columns:1fr 1fr!important;gap:18px!important;margin-top:18px!important}.kostolany-egg .egg-tables table{font-size:13px!important}.kostolany-egg .egg-tables th{font-size:10px!important;color:var(--ke-muted)!important;letter-spacing:.09em!important}.kostolany-egg .egg-tables td{border-bottom:1px solid rgba(44,42,37,.08)!important;padding:9px 7px!important}
.kostolany-egg .egg-tables tr.good td:first-child,.kostolany-egg .egg-tables tr.good td:nth-child(2){color:var(--ke-green)!important;font-weight:700!important}.kostolany-egg .egg-tables tr.bad td:first-child,.kostolany-egg .egg-tables tr.bad td:nth-child(2){color:var(--ke-red)!important;font-weight:700!important}.kostolany-egg .egg-tables tr.warn td:nth-child(2){color:var(--ke-muted)!important;font-weight:700!important}
.kostolany-egg .egg-map-foot{opacity:.62!important}
@media(max-width:1050px){.kostolany-egg .egg-command,.kostolany-egg .egg-v2-grid,.kostolany-egg .egg-tables{grid-template-columns:1fr!important}}
</style>`;

html=html.replace(/<style id="kostolany-egg-v3-style">[\s\S]*?<\/style>/g,'');
html=html.replace('</head>',css+'</head>');
fs.writeFileSync(indexPath,html);
console.log('applied restrained two-color Kostolany egg visual v3');
