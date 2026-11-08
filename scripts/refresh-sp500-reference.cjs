'use strict';
/*
 * Monthly S&P 500 reference refresh from State Street's daily SPY holdings file (ssga.com).
 * Rewrites data/sp500-marketcap-rank.json (rank by index weight = rank by float market cap;
 * the recognizability gate reads rank <= 200) and data/sp500-constituents.json (momentum,
 * volume-screen and arb universes). Runs at most once per 25 days; on any fetch or parse
 * problem it keeps the existing files and exits 0 — the build never depends on it.
 *
 * The xlsx is read with node:zlib (no dependencies): unzip via the central directory, then
 * read sharedStrings + sheet1 XML.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const rankPath = path.join(root, 'data', 'sp500-marketcap-rank.json');
const consPath = path.join(root, 'data', 'sp500-constituents.json');
const URL = 'https://www.ssga.com/us/en/intermediary/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx';
const MIN_AGE_DAYS = 25;
const force = process.argv.includes('--force');

function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unescapeXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function readSheet(files) {
  const shared = [];
  const ss = files['xl/sharedStrings.xml']?.toString('utf8') || '';
  for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) || []) shared.push(unescapeXml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')));
  const sheetName = Object.keys(files).find(n => /^xl\/worksheets\/sheet1\.xml$/.test(n)) || Object.keys(files).find(n => n.startsWith('xl/worksheets/'));
  const xml = files[sheetName].toString('utf8');
  const rows = [];
  for (const r of xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
    const cells = {};
    for (const c of r.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/r="([A-Z]+)\d+"/) || [])[1];
      const type = (c.match(/t="(\w+)"/) || [])[1];
      const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      const inline = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      cells[ref] = type === 's' ? shared[Number(v)] : type === 'inlineStr' ? unescapeXml(inline || '') : v != null ? unescapeXml(v) : null;
    }
    rows.push(cells);
  }
  return rows;
}

async function main() {
  const current = JSON.parse(fs.readFileSync(rankPath, 'utf8'));
  const ageDays = (Date.now() - Date.parse(current.asOf)) / 86_400_000;
  if (!force && ageDays < MIN_AGE_DAYS) { console.log(`refresh-sp500-reference: ranks ${current.asOf} are ${ageDays.toFixed(0)}d old — not due`); return; }

  const res = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 CapitalRadar/1.0' }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = readSheet(unzip(Buffer.from(await res.arrayBuffer())));

  const asOfCell = rows.map(r => r.B).find(v => /As of/i.test(v || '')) || '';
  const m = asOfCell.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) throw new Error(`no holdings date in "${asOfCell}"`);
  const asOf = new Date(`${m[2]} ${m[1]}, ${m[3]} UTC`).toISOString().slice(0, 10);

  const header = rows.findIndex(r => r.A === 'Name' && r.B === 'Ticker');
  if (header < 0) throw new Error('header row not found');
  const holdings = rows.slice(header + 1)
    .filter(r => r.B && /^[A-Z][A-Z.\-]{0,6}$/.test(r.B) && Number(r.E) > 0 && (r.H || 'USD') === 'USD')
    .map(r => ({ symbol: r.B.replace('.', '-'), name: r.A, weightPct: Math.round(Number(r.E) * 1000) / 1000 }))
    .sort((a, b) => b.weightPct - a.weightPct);
  // Sanity: the S&P 500 has ~500 lines (dual share classes push it slightly over).
  if (holdings.length < 480 || holdings.length > 520) throw new Error(`unexpected holdings count ${holdings.length}`);

  fs.writeFileSync(rankPath, JSON.stringify({
    ...current,
    asOf,
    source: 'State Street SPDR S&P 500 ETF (SPY) daily holdings, ranked by index weight',
    source_url: URL,
    note: 'Rank by index weight = rank by float-adjusted market cap. Recognizability gate: rank <= 200. Refreshed monthly by scripts/refresh-sp500-reference.cjs.',
    ranked: holdings.map((h, i) => ({ rank: i + 1, symbol: h.symbol, name: h.name, weightPct: h.weightPct })),
  }, null, 2) + '\n');

  const cons = JSON.parse(fs.readFileSync(consPath, 'utf8'));
  const symbols = holdings.map(h => h.symbol).sort();
  const added = symbols.filter(s => !cons.symbols.includes(s));
  const removed = cons.symbols.filter(s => !symbols.includes(s));
  fs.writeFileSync(consPath, JSON.stringify({ ...cons, asOf, source: 'State Street SPY daily holdings (ssga.com)', count: symbols.length, symbols }, null, 2) + '\n');
  console.log(`refresh-sp500-reference: ${holdings.length} constituents as of ${asOf}; added ${added.join(',') || 'none'}; removed ${removed.join(',') || 'none'}`);
}

main().catch(err => console.warn(`refresh-sp500-reference: ${err.message} — keeping existing reference files`));
