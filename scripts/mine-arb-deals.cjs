'use strict';
/*
 * mine-arb-deals.cjs — Phase 3 arb trading brain: SEC 8-K merger miner.
 *
 * For every S&P 500 constituent: resolve CIK, fetch the SEC submissions JSON,
 * scan 8-K filings filed in the last ~120 days for merger language, fetch each
 * candidate 8-K primary document, score confidence (HIGH/MEDIUM/LOW), and
 * extract deal terms (consideration type, per-share price or exchange ratio,
 * acquirer, expected close, termination fee, risk-flag language).
 *
 * Output: outputs/arb/arb-deals-mined.json
 *
 * Politeness: concurrency 3, ~350ms inter-request delay per worker, repo
 * standard SEC User-Agent. 8-K documents are cached in data/cache so daily
 * runs only fetch new filings.
 *
 * Usage: node scripts/mine-arb-deals.cjs [--sample N] [--concurrency N]
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const UA = 'CapitalRadar/1.0 jun.hn.nam@gmail.com';
const LOOKBACK_DAYS = 120;
const CACHE_DIR = path.join(root, 'data', 'cache');
const TICKER_CACHE = path.join(CACHE_DIR, 'company_tickers.json');
const DOC_CACHE_PATH = path.join(CACHE_DIR, 'arb-8k-cache.json');
const OUT_DIR = path.join(root, 'outputs', 'arb');
const OUT_PATH = path.join(OUT_DIR, 'arb-deals-mined.json');

const args = process.argv.slice(2);
function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}
const SAMPLE = argVal('--sample') ? parseInt(argVal('--sample'), 10) : 0;
const CONCURRENCY = argVal('--concurrency') ? parseInt(argVal('--concurrency'), 10) : 3;
const REQUEST_DELAY_MS = 350;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - LOOKBACK_DAYS);
const cutoffISO = cutoff.toISOString().slice(0, 10);

function getText(url, accept) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; clearTimeout(timer); resolve(r); } };
    const timer = setTimeout(() => { try { req.destroy(); } catch { /* noop */ } finish({ ok: false, status: 0, body: '', error: 'timeout' }); }, 25000);
    const req = https.get(url, { headers: { 'User-Agent': UA, Accept: accept || 'text/html,*/*' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        getText(res.headers.location, accept).then(finish);
        return;
      }
      if (res.statusCode !== 200) { res.resume(); finish({ ok: false, status: res.statusCode, body: '' }); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => { body += d; if (body.length > 1_500_000) { res.resume(); try { req.destroy(); } catch { /* noop */ } finish({ ok: true, status: 200, body, truncated: true }); } });
      res.on('end', () => finish({ ok: true, status: 200, body }));
      res.on('error', () => finish({ ok: false, status: 0, body: '', error: 'response error' }));
    });
    req.on('error', e => finish({ ok: false, status: 0, body: '', error: e.message }));
    req.on('close', () => finish({ ok: false, status: 0, body: '', error: 'connection closed' }));
  });
}
const getJson = async url => {
  const r = await getText(url, 'application/json');
  if (!r.ok) return null;
  try { return JSON.parse(r.body); } catch { return null; }
};

const stripTags = html => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

// ---------------- scoring & extraction ----------------

function normName(s) {
  return String(s || '').replace(/[.,;:'"()]/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanAcquirer(raw) {
  if (!raw) return null;
  let s = normName(raw);
  s = s.replace(/^(a|an|the|its|their)\s+/i, '');
  // strip leading press-release datelines: "June 25 2026 Merck KGaA ..." -> "Merck KGaA ..."
  s = s.replace(/^(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\s+)+/i, '').trim();
  // strip jurisdiction tail: "Copart Inc a Delaware corporation" -> "Copart Inc"
  s = s.replace(/\s+a\s+[\w ]*corporation$/i, '').replace(/\s+an?\s+[\w ]*(?:limited liability company|llc)$/i, '').trim();
  const GENERIC = /^(company|corporation|business|entity|party|parties|buyer|seller|issuer|registrant|parent|subsidiary|merger sub|acquiror|acquiree)$/i;
  if (GENERIC.test(s)) return null;
  if (s.length < 3 || s.length > 80) return null;
  if (!/^[A-Z]/.test(s)) return null;
  return s;
}

// Defined-term parties: merger 8-Ks define "Parent" (acquirer side) and
// "Company"/"ACV"/etc. Match the filer against the Parent/Company definitions.
function definedParties(text) {
  const out = [];
  const re = /([A-Z][\w&.'\-, ]{2,80}?(?:,\s*a\s+[\w ]+?corporation)?)\s*\(\s*(?:the\s+)?(?:"|"|“|”|&#8220;|&#8221;|&#8216;|&#8217;|')\s*([A-Z][\w .\-]{1,40}?)\s*(?:"|"|“|”|&#8220;|&#8221;|&#8216;|&#8217;|')\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = cleanAcquirer(m[1]);
    if (name) out.push({ name, term: m[2].trim() });
  }
  return out;
}
const filerMatches = (filerName, partyName) => {
  const fn = normName(filerName).toUpperCase();
  const pn = normName(partyName).toUpperCase();
  const f = fn.split(' ')[0];
  const p = pn.split(' ')[0];
  return f.length > 2 && p.length > 2 && (pn.includes(f) || fn.includes(p));
};
// Corporate-suffix-insensitive equality for the self-reference guard.
const sameCompany = (a, b) => {
  const strip = s => String(s || '').toUpperCase().replace(/[.,]/g, ' ')
    .replace(/\b(INC|CORP|CORPORATION|COMPANY|LLC|LTD|LIMITED|CO|HOLDINGS|HOLDING|GROUP|LP|LLP|TRUST|PLC)\b/g, '')
    .replace(/\s+/g, ' ').trim();
  const x = strip(a), y = strip(b);
  return x.length > 2 && (x === y || x.includes(y) || y.includes(x));
};

// Determine whether the filing company is the acquirer or the target.
function detectFilerRole(text, filerName) {
  // 1) Parent/Company defined terms — the most reliable direction signal.
  const parties = definedParties(text);
  const parentP = parties.find(p => /^parent$/i.test(p.term));
  const companyP = parties.find(p => /^(the )?company$/i.test(p.term));
  if (parentP && filerMatches(filerName, parentP.name)) {
    const other = companyP ? companyP.name
      : (parties.find(p => !filerMatches(filerName, p.name) && !/^(parent|merger sub|merger agreement|agreement)$/i.test(p.term)) || {}).name || null;
    return { role: 'acquirer', counterparty: other };
  }
  if (companyP && parentP && filerMatches(filerName, companyP.name)) {
    return { role: 'target', counterparty: parentP ? parentP.name : null };
  }
  const filerFirst = normName(filerName).split(' ')[0] || '';
  // "the proposed acquisition of X" -> X is the target; the filer (when it is
  // "the Company" whose merger subs execute the deal) is the acquirer.
  const ma = text.match(/(?:proposed\s+)?acquisition(?:\s*\([^)]{0,80}\))?\s+of\s+([A-Z][\w&.'\-, ]{2,60}?)(?:,|\.|;|\s+by\s|\s*\()/i);
  if (ma) {
    const tgt = cleanAcquirer(ma[1]);
    if (tgt && !filerMatches(filerName, tgt)) return { role: 'acquirer', counterparty: tgt };
  }
  // deal-completion notice: "completion of its acquisition of X" -> filer is
  // the acquirer, X is the (now former) target.
  const mc = text.match(/completion of (?:its|the) acquisition of ([A-Z][\w&.'\-, ]{2,60}?)(?:,|\.|;|\s*\()/i);
  if (mc) {
    const tgt = cleanAcquirer(mc[1]);
    if (tgt) return { role: 'acquirer', counterparty: tgt, completedNotice: true };
  }
  // "X will acquire Y" / "X agrees to acquire Y": compare both parties against the filer name.
  let m = text.match(/([A-Z][\w&.'\-, ]{2,60}?)\s+(?:will|shall|has agreed to|agrees? to)\s+acquire\s+([A-Z][\w&.'\-, ]{2,60}?)(?:,|\.|;|\s*\()/i);
  if (m) {
    const p1 = cleanAcquirer(m[1]), p2 = cleanAcquirer(m[2]);
    if (p1 && p2) {
      if (filerMatches(filerName, p1)) return { role: 'acquirer', counterparty: p2 };
      if (filerMatches(filerName, p2)) return { role: 'target', counterparty: p1 };
    }
  }
  // "Merger Sub will [be] merge[d] with and into Y, with Y as the surviving corporation"
  // -> Y is the target; the filer (unless it IS Y) sits on the acquirer side.
  m = text.match(/will (?:be )?merged? with and into ([A-Z][\w&.'\-, ]{2,60}?)(?:,|\s)+with\s+as the surviving/i) ||
      text.match(/will (?:be )?merged? with and into ([A-Z][\w&.'\-, ]{2,60}?)(?:,|\.|;|\s*\()/i);
  if (m) {
    const tgt = cleanAcquirer(m[1]);
    if (tgt) {
      if (filerFirst.length > 2 && normName(tgt).includes(filerFirst)) return { role: 'target', counterparty: null };
      return { role: 'acquirer', counterparty: tgt };
    }
  }
  m = text.match(/pursuant to which the (?:&#8220;|"|“)?Company(?:&#8221;|"|”)? (?:will|shall|has agreed to) acquire ([A-Z][\w&.'\-, ]{2,70}?)(?:,|\.|;|\s*\()/i) ||
      text.match(/the (?:&#8220;|"|“)?Company(?:&#8221;|"|”)? will acquire ([A-Z][\w&.'\-, ]{2,70}?)(?:,|\.|;|\s*\()/i) ||
      text.match(/announcing (?:a |the )?definitive agreement pursuant to which ([\w&.'\-, ]{2,70}?) will acquire ([A-Z][\w&.'\-, ]{2,70}?)(?:,|\.|;|\s*\()/i);
  if (m) {
    const other = cleanAcquirer(m[2] || m[1]);
    if (other) return { role: 'acquirer', counterparty: other };
  }
  m = text.match(/(?:will be|to be) acquired by ([A-Z][\w&.'\- ]{2,70}?)(?:,|\.|;|\s*\()/i);
  if (m) { const c = cleanAcquirer(m[1]); if (c) return { role: 'target', counterparty: c }; }
  const acq = extractAcquirer(text);
  if (acq) return { role: 'target', counterparty: acq };
  return { role: 'unclear', counterparty: null };
}

let NAME_INDEX = null;
function buildNameIndex(tickerMap) {
  NAME_INDEX = [];
  for (const v of Object.values(tickerMap)) {
    const ticker = String(v.ticker || '').toUpperCase();
    const nm = String(v.title || v.name || '').toUpperCase().replace(/[.,]/g, ' ').replace(/\b(INC|CORP|CORPORATION|COMPANY|LLC|LTD|LIMITED|CO|HOLDINGS|HOLDING|GROUP|LP|LLP|TRUST|PLC|SA|AG|NV|THE)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (nm && ticker) NAME_INDEX.push({ ticker, nm });
  }
}
function resolveTickerByName(name) {
  if (!NAME_INDEX || !name) return null;
  const nm = String(name).toUpperCase().replace(/[.,]/g, ' ').replace(/\b(INC|CORP|CORPORATION|COMPANY|LLC|LTD|LIMITED|CO|HOLDINGS|HOLDING|GROUP|LP|LLP|TRUST|PLC|SA|AG|NV|THE)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!nm) return null;
  // Bare ticker used as a name in the filing ("WBD"): resolve literally.
  // 3-5 chars only — 1-2 letter words ("IT", "D") collide with plain English.
  if (/^[A-Z]{3,5}$/.test(nm)) {
    const tick = NAME_INDEX.find(e => e.ticker === nm);
    if (tick) return { symbol: tick.ticker, method: 'ticker-literal' };
  }
  const exact = NAME_INDEX.find(e => e.nm === nm);
  if (exact) return { symbol: exact.ticker, method: 'name-exact' };
  // word-overlap: require at least 2 shared significant words or first-word + strong overlap
  const words = nm.split(' ').filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const e of NAME_INDEX) {
    const ew = e.nm.split(' ');
    const shared = words.filter(w => ew.includes(w)).length;
    const score = shared / Math.max(words.length, 1);
    if (score > bestScore) { bestScore = score; best = e; }
  }
  if (best && bestScore >= 0.6 && words.length >= 2) return { symbol: best.ticker, method: 'name-fuzzy' };
  // NOTE: no single-first-word fallback — it misfires on near-names
  // ("Apogee" -> Apogee Enterprises for Apogee Therapeutics; "PS Canada" -> Canada Goose).
  return null;
}

// Fetch Exhibit 99.1 (press release) when the 8-K body lacks per-share terms.
async function fetchExhibitTerms(rawHtml, dirUrl) {
  const links = [];
  for (const m of rawHtml.matchAll(/href="([^"]*ex99[^"]*\.htm[l]?)"[^>]{0,200}>([^<]{0,120})/gi)) links.push({ href: m[1], label: m[2] });
  for (const m of rawHtml.matchAll(/href="([^"]*press[^"]*\.htm[l]?)"[^>]{0,200}>([^<]{0,120})/gi)) links.push({ href: m[1], label: m[2] });
  for (const l of links.slice(0, 2)) {
    const url = l.href.startsWith('http') ? l.href : dirUrl + l.href.split('/').pop();
    const res = await getText(url);
    await sleep(REQUEST_DELAY_MS);
    if (!res.ok) continue;
    const body = stripTags(res.body);
    const terms = extractTerms(body);
    if (terms.offerPricePerShare || terms.exchangeRatio) return { terms, exhibitUrl: url, exhibitLabel: l.label.trim(), exhibitText: body };
  }
  return null;
}

function extractAcquirer(text) {
  const patterns = [
    /entered into (?:a |an |the )?Agreement and Plan of Merger[^.]{0,300}? with ([A-Z][\w&.'\- ]{2,70}?)(?:,|\.|;|\s*\(|\s+dated)/i,
    /Agreement and Plan of Merger[^.]{0,300}? among ([A-Z][\w&.'\- ]{2,70}?)(?:,|\.|;|\s*\()/i,
    /(?:will be|to be) acquired by ([A-Z][\w&.'\- ]{2,70}?)(?:,|\.|;|\s*\()/i,
    /pursuant to which ([A-Z][\w&.'\- ]{2,70}?) (?:will|shall) acquire/i,
    /merger with and into ([A-Z][\w&.'\- ]{2,70}?)(?:,|\.|;|\s*\()/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const c = cleanAcquirer(m[1]);
      if (c) return c;
    }
  }
  return null;
}

function parseMoney(num, unit) {
  let v = parseFloat(String(num).replace(/,/g, ''));
  if (/billion/i.test(unit || '')) v *= 1e9;
  else if (/million/i.test(unit || '')) v *= 1e6;
  else if (/thousand/i.test(unit || '')) v *= 1e3;
  return v;
}

function extractTerms(text) {
  const t = { rejected: 0 };
  // Window-based extraction: the per-share price (or exchange ratio) must sit
  // within a ±500-char window carrying hard merger language, and windows
  // describing VWAPs, equity programs, offerings or dividends are excluded.
  // ("per share" alone is not deal language: VWAP and ATM disclosures use it.)
  const dealish = w => /\b(merger|acquisition|acquire[sd]?|tender offer|merger consideration)\b/i.test(w)
    && !/dividend|distribut|buyback|repurchase|stock split|vwap|volume.weighted|forward sale|at.the.market|offering|underwrit|prospectus|commission/i.test(w);
  const windowFor = idx => text.slice(Math.max(0, idx - 500), idx + 500);
  const priceRe = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,4})?)\s*(?:in cash\s+)?per share|per share (?:of|in) (?:cash of )?\$?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,4})?)/gi;
  let pm;
  while ((pm = priceRe.exec(text)) !== null) {
    // "par value $0.001 per share" is charter boilerplate; "exercise price of $X
    // per share" is a warrant/option term — neither is merger consideration.
    // Reject only when adjacent to THIS price, not window-wide.
    if (/par value|exercise price|warrant/i.test(text.slice(Math.max(0, pm.index - 40), pm.index))) { t.rejected++; continue; }
    const w = windowFor(pm.index);
    if (!dealish(w)) continue;
    const v = parseFloat((pm[1] || pm[2]).replace(/,/g, ''));
    if (v >= 2) { t.offerPricePerShare = v; t.considerationType = 'cash'; break; }
    t.rejected++;
  }
  const ratioRe = /exchange ratio of (?:approximately\s+)?(\d+\.\d{1,4})|(\d+\.\d{1,4})\s*shares?\s+of\s+[\w\s&.'\-]+?\s+common stock/gi;
  while ((pm = ratioRe.exec(text)) !== null) {
    const w = windowFor(pm.index);
    if (!dealish(w)) continue;
    const v = parseFloat(pm[1] || pm[2]);
    if (v > 0 && v < 100) { t.exchangeRatio = v; t.considerationType = t.considerationType === 'cash' ? 'mixed' : 'stock'; break; }
    t.rejected++;
  }
  // collar language
  if (/\bcollar\b/i.test(text) && t.considerationType === 'stock') t.considerationType = 'collar';
  // expected close
  const qmap = { Q1: '03-31', Q2: '06-30', Q3: '09-30', Q4: '12-31' };
  let m = text.match(/(?:expected|anticipated|anticipates|targeted)[^.]{0,120}?(Q[1-4])\s*(?:of\s*)?(?:calendar\s+year\s+)?(?:'?\s*)?(\d{4})/i) ||
      text.match(/closing[^.]{0,120}?is\s+expected[^.]{0,80}?(Q[1-4])\s*(?:of\s*)?(?:calendar\s+year\s+)?(\d{4})/i);
  if (m) {
    t.expectedCloseDate = `${m[2]}-${qmap[m[1].toUpperCase()]}`;
    t.expectedCloseLabel = `${m[1].toUpperCase()} ${m[2]}`;
  } else {
    m = text.match(/(?:expected|anticipated|anticipates|targeted)[^.]{0,120}?(first|second|third|fourth)\s+(quarter|half)\s+of\s+(?:calendar\s+year\s+)?(\d{4})/i);
    if (m) {
      const qend = m[2] === 'half'
        ? ({ first: '06-30', second: '12-31' })[m[1]]
        : ({ first: '03-31', second: '06-30', third: '09-30', fourth: '12-31' })[m[1]];
      t.expectedCloseDate = `${m[3]}-${qend}`;
      t.expectedCloseLabel = `${m[1]} ${m[2]} ${m[3]}`;
    } else {
      // "expected to close by (calendar) year-end YYYY" -> Dec 31 of that year.
      // Conservative endpoint: a later close date understates the annualized spread.
      m = text.match(/(?:expected|anticipated|anticipates)[^.]{0,120}?close\s+by\s+(?:calendar\s+)?year[\s-]?end\s+(\d{4})/i);
      if (m) {
        t.expectedCloseDate = `${m[1]}-12-31`;
        t.expectedCloseLabel = `year-end ${m[1]}`;
      }
    }
  }
  // termination fee
  m = text.match(/termination fee[^.]{0,100}\$\s?([\d.,]+)\s*(billion|million|thousand)?/i);
  if (m) t.terminationFeeUSD = parseMoney(m[1], m[2] || '');
  // deal value
  m = text.match(/(?:aggregate|total|enterprise|equity)\s+(?:equity\s+|transaction\s+|enterprise\s+)?value[^.]{0,80}\$\s?([\d.,]+)\s*(billion|million)/i);
  if (m) t.dealValueUSD = parseMoney(m[1], m[2]);
  return t;
}

function riskFlags(text, deal) {
  const flags = {};
  flags.financing = /financing\s+(condition|commitment)/i.test(text) ? 'mentioned' : 'none-mentioned';
  flags.goShop = /go[-\s]?shop/i.test(text);
  flags.shareholderVote = /(stockholder|shareholder)\s+(vote|approval)/i.test(text) ? 'pending' : 'not-stated';
  let regulatory = 'standard';
  const megaCapTech = /\b(Apple|Microsoft|NVIDIA|Amazon|Alphabet|Google|Meta|Broadcom|Oracle|Tesla)\b/i;
  if ((deal.dealValueUSD && deal.dealValueUSD > 10e9) || (deal.acquirer && megaCapTech.test(deal.acquirer))) regulatory = 'elevated';
  flags.regulatory = regulatory;
  return flags;
}

function scoreDoc(text, terms) {
  const sents = dealSentences(text);
  // A bare "definitive agreement" only counts when the same sentence carries a
  // merger noun — this excludes 8-K Item 1.01 captions ("Entry into a Material
  // Definitive Agreement") for unrelated transactions.
  const mergerNoun = /\b(merger|acquisition|acquire[sd]?)\b/i;
  const definitiveSent = sents.find(s => /agreement and plan of merger|definitive merger agreement/i.test(s) ||
    (/definitive agreement/i.test(s) && mergerNoun.test(s)));
  const announcedSent = sents.length > 0;
  const completed = COMPLETION_PATTERNS.some(p => p.test(text));
  const hasTerms = !!(terms && (terms.offerPricePerShare || terms.exchangeRatio));
  const soft = SOFT_PATTERNS.some(p => p.test(text));
  // completion notice wins over boilerplate: risk-factor text in a closing 8-K
  // still mentions the "Merger Agreement", but the deal is done.
  if (completed) return { confidence: 'LOW', reason: 'deal completion announced — no longer tradeable', completed: true };
  if (definitiveSent && hasTerms) return { confidence: 'HIGH', reason: 'definitive agreement text with per-share terms' };
  if (definitiveSent) return { confidence: 'MEDIUM', reason: 'definitive agreement announced, per-share terms not extracted' };
  if (announcedSent && hasTerms) return { confidence: 'MEDIUM', reason: 'merger announced with terms described' };
  if (soft && !announcedSent) return { confidence: 'LOW', reason: 'strategic alternatives / unconfirmed' };
  if (announcedSent) return { confidence: 'LOW', reason: 'merger language, no definitive agreement or terms' };
  if (/rumor|reportedly|unnamed sources/i.test(text)) return { confidence: 'LOW', reason: 'rumor language' };
  return null;
}

// Sentence-level deal detection: a "deal sentence" mentions a merger/acquisition
// AND deal-announcement language in the same sentence. This kills covenant
// boilerplate ("obligations regarding a consolidation, merger or sale") and
// debt exchange offers (registration-rights "exchange offer" for notes, which
// never sits next to tender/shares/stockholders language).
const DEAL_NOUN = /\b(merger|acquisition|acquire[sd]?|tender offer)\b/i;
const DEAL_EXCH_OFFER = /\bexchange offer\b.{0,120}\b(shares|shareholders|stockholders|tender)\b/i;
const DEAL_VERB = /\b(agreement|announc|definitive|offer|per share|exchange ratio|will acquire|to acquire|completed acquisition|closing of)\b/i;
function dealSentences(text) {
  const sents = text.match(/[^.!?;]{20,700}[.!?;]/g) || [];
  return sents.filter(s => (DEAL_NOUN.test(s) || DEAL_EXCH_OFFER.test(s)) && DEAL_VERB.test(s));
}
const SOFT_PATTERNS = [/strategic alternatives/i, /exploring strategic/i, /reviewing strategic/i];
const COMPLETION_PATTERNS = [/completion of (?:its|the) acquisition/i, /announces? the closing of/i, /has completed (?:its|the) acquisition/i, /closed (?:its|the) (?:merger|acquisition)/i];

function prefilter(text) {
  if (SOFT_PATTERNS.some(p => p.test(text))) return true;
  if (COMPLETION_PATTERNS.some(p => p.test(text))) return true;
  return dealSentences(text).length > 0;
}

// ---------------- run ----------------
process.on('unhandledRejection', e => { console.error('UNHANDLED REJECTION:', e && e.message); });

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const universe = JSON.parse(fs.readFileSync(path.join(root, 'data', 'sp500-constituents.json'), 'utf8'));
  let symbols = universe.symbols.map(s => String(s).toUpperCase());
  if (SAMPLE > 0) symbols = symbols.slice(0, SAMPLE);

  let tickerMap = null;
  try { tickerMap = JSON.parse(fs.readFileSync(TICKER_CACHE, 'utf8')); } catch { /* fetch */ }
  if (!tickerMap) {
    tickerMap = await getJson('https://www.sec.gov/files/company_tickers.json');
    if (!tickerMap) throw new Error('could not fetch company_tickers.json');
    fs.writeFileSync(TICKER_CACHE, JSON.stringify(tickerMap));
  }
  const cikByTicker = {};
  for (const v of Object.values(tickerMap)) cikByTicker[String(v.ticker || '').toUpperCase()] = String(v.cik_str).padStart(10, '0');
  buildNameIndex(tickerMap);

  let docCache = {};
  try { docCache = JSON.parse(fs.readFileSync(DOC_CACHE_PATH, 'utf8')); } catch { /* fresh */ }

  const coverage = { symbolsScanned: 0, cikResolved: 0, submissionsOk: 0, filingsScanned: 0, docsFetched: 0, docsFromCache: 0, termsRejected: 0, errors: [] };
  const deals = [];
  const seen = new Set();

  async function processSymbol(symbol) {
    coverage.symbolsScanned++;
    if (coverage.symbolsScanned % 25 === 0) console.error(`[miner] ${coverage.symbolsScanned}/${symbols.length} symbols, filings=${coverage.filingsScanned}, deals=${deals.length}`);
    if (coverage.symbolsScanned % 100 === 0) { try { fs.writeFileSync(DOC_CACHE_PATH, JSON.stringify(docCache)); } catch { /* noop */ } }
    const cik = cikByTicker[symbol];
    if (!cik) { coverage.errors.push({ symbol, error: 'cik_not_found' }); return; }
    coverage.cikResolved++;
    const sub = await getJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
    await sleep(REQUEST_DELAY_MS);
    if (!sub || !sub.filings || !sub.filings.recent) { coverage.errors.push({ symbol, cik, error: 'submissions_unavailable' }); return; }
    coverage.submissionsOk++;
    const r = sub.filings.recent;
    const companyName = sub.name || symbol;
    const cands = [];
    for (let i = 0; i < r.form.length; i++) {
      if (!/^8-K/.test(r.form[i])) continue;
      if ((r.filingDate[i] || '') < cutoffISO) continue;
      cands.push({ accession: r.accessionNumber[i], doc: r.primaryDocument[i], filingDate: r.filingDate[i], form: r.form[i] });
    }
    coverage.filingsScanned += cands.length;
    for (const c of cands) {
      const key = `${c.accession}/${c.doc}`;
      let scored = docCache[key];
      if (!scored) {
        const dirUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${c.accession.replace(/-/g, '')}/`;
        const url = dirUrl + c.doc;
        const res = await getText(url);
        await sleep(REQUEST_DELAY_MS);
        coverage.docsFetched++;
        if (!res.ok || !prefilter(res.body)) { docCache[key] = { skipped: true, fetchedAt: new Date().toISOString() }; continue; }
        const text = stripTags(res.body);
        let terms = extractTerms(text);
        let exhibit = null;
        const prelimDefinitive = /agreement and plan of merger|definitive (merger )?agreement/i.test(text) && /\bmerger\b/i.test(text);
        if (prelimDefinitive && !terms.offerPricePerShare && !terms.exchangeRatio) {
          exhibit = await fetchExhibitTerms(res.body, dirUrl);
          if (exhibit) terms = { ...terms, ...exhibit.terms };
        }
        // Role detection reads the exhibit too: 7.01 press-release 8-Ks keep
        // the merger direction language in Exhibit 99.1, not the body.
        const roleText = exhibit && exhibit.exhibitText ? text + '\n' + exhibit.exhibitText : text;
        const s = scoreDoc(text, terms);
        if (!s) { docCache[key] = { skipped: true, fetchedAt: new Date().toISOString() }; continue; }
        coverage.termsRejected += terms.rejected || 0;
        const roleInfo = detectFilerRole(roleText, companyName);
        // Expand short all-caps defined terms ("WBD") to the full party name
        // from the filing's own definitions, so ticker resolution can work.
        if (roleInfo.counterparty && /^[A-Z0-9]{2,6}$/.test(roleInfo.counterparty.trim())) {
          const dp = definedParties(roleText).find(p => p.term.toUpperCase() === roleInfo.counterparty.trim().toUpperCase());
          if (dp && dp.name.length > roleInfo.counterparty.length) roleInfo.counterparty = dp.name;
        }
        const counterpartyRes = roleInfo.counterparty ? resolveTickerByName(roleInfo.counterparty) : null;
        let targetSymbol = symbol, targetName = companyName, acquirer = null, acquirerSymbol = null;
        if (roleInfo.role === 'acquirer') {
          acquirer = companyName; acquirerSymbol = symbol;
          targetName = roleInfo.counterparty;
          targetSymbol = counterpartyRes ? counterpartyRes.symbol : null;
        } else if (roleInfo.role === 'target') {
          acquirer = roleInfo.counterparty;
          acquirerSymbol = counterpartyRes ? counterpartyRes.symbol : null;
        } else {
          acquirer = roleInfo.counterparty || extractAcquirer(text);
          if (acquirer) { const r2 = resolveTickerByName(acquirer); acquirerSymbol = r2 ? r2.symbol : null; }
        }
        // "Merger Sub" acquirers are shells: resolve to the real parent.
        if (acquirer && /merger sub/i.test(acquirer)) {
          const pm = text.match(/wholly owned subsidiary of ([A-Z][\w&.'\-, ]{2,60}?)(?:,|\.|;)/i);
          if (pm) {
            const real = cleanAcquirer(pm[1]);
            if (real && !/merger sub/i.test(real)) {
              acquirer = real;
              const r3 = resolveTickerByName(acquirer);
              acquirerSymbol = r3 ? r3.symbol : null;
            }
          }
        }
        // Self-referential acquirer == target means direction detection failed;
        // drop the entry rather than fabricate a deal against the filer itself.
        if (acquirer && targetName && sameCompany(acquirer, targetName)) {
          docCache[key] = { skipped: true, reason: 'self-referential', fetchedAt: new Date().toISOString() };
          continue;
        }
        // Acquirer-side filing with no identifiable target: not a usable deal.
        if (roleInfo.role === 'acquirer' && !targetName) {
          docCache[key] = { skipped: true, reason: 'no-target', fetchedAt: new Date().toISOString() };
          continue;
        }
        const deal = {
          target: targetSymbol || targetName, targetSymbol, targetName,
          acquirer, acquirerSymbol,
          filerSymbol: symbol, filerRole: roleInfo.role,
          counterpartyResolution: counterpartyRes ? counterpartyRes.method : null,
          mergerOfEquals: /merger[\s-]?of[\s-]?equals/i.test(roleText),
          considerationType: terms.considerationType || null,
          offerPricePerShare: terms.offerPricePerShare ?? null,
          exchangeRatio: terms.exchangeRatio ?? null,
          expectedCloseDate: terms.expectedCloseDate || null,
          expectedCloseLabel: terms.expectedCloseLabel || null,
          terminationFeeUSD: terms.terminationFeeUSD ?? null,
          dealValueUSD: terms.dealValueUSD ?? null,
          confidence: s.confidence, confidenceReason: s.reason,
          status: s.completed ? 'completed' : 'pending',
          riskFlags: riskFlags(text, { ...terms, acquirer }),
          filingUrl: url, exhibitUrl: exhibit ? exhibit.exhibitUrl : null, filingDate: c.filingDate, form: c.form,
          source: 'sec-8k', minedAt: new Date().toISOString(),
        };
        scored = { deal, fetchedAt: new Date().toISOString() };
        docCache[key] = scored;
      } else if (scored.deal) {
        coverage.docsFromCache++;
      }
      if (scored.deal && !seen.has(key)) {
        seen.add(key);
        deals.push(scored.deal);
      }
    }
  }

  // worker pool
  const queue = [...symbols];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const sym = queue.shift();
      try { await processSymbol(sym); }
      catch (e) { coverage.errors.push({ symbol: sym, error: e.message }); }
    }
  });
  await workers.reduce((a, b) => a.then(() => b), Promise.resolve());

  fs.writeFileSync(DOC_CACHE_PATH, JSON.stringify(docCache));
  // dedupe by target: multiple 8-Ks (both sides, amendments, closing notices)
  // routinely describe the same deal. Keep the highest-confidence entry, merge
  // evidence URLs, propagate completion, prefer extracted terms.
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const targetKey = d => {
    const sym = (d.targetSymbol || '').toUpperCase();
    if (sym) return `sym:${sym}`;
    // no symbol (delisted / non-S&P target): fall back to first word of the name
    return `name:${normName(d.targetName).split(' ')[0]}`;
  };
  const byKey = new Map();
  for (const d of deals) {
    const k = targetKey(d);
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, d); continue; }
    const winner = (rank[d.confidence] || 0) >= (rank[prev.confidence] || 0) ? d : prev;
    const loser = winner === d ? prev : d;
    winner.evidenceUrls = [...new Set([...(winner.evidenceUrls || [winner.filingUrl]), ...(loser.evidenceUrls || [loser.filingUrl])].filter(Boolean))];
    if (loser.status === 'completed') winner.status = 'completed';
    // prefer any extracted terms the winner lacks
    for (const f of ['considerationType', 'offerPricePerShare', 'exchangeRatio', 'expectedCloseDate', 'expectedCloseLabel', 'terminationFeeUSD', 'dealValueUSD', 'acquirer', 'acquirerSymbol']) {
      if (winner[f] == null && loser[f] != null) winner[f] = loser[f];
    }
    if (winner.confidenceReason && loser.confidenceReason && !winner.confidenceReason.includes('merged')) {
      winner.confidenceReason += ` [merged ${loser.filingDate || '?'} filing]`;
    }
    byKey.set(k, winner);
  }
  const uniqueDeals = [...byKey.values()];
  const byConf = c => uniqueDeals.filter(d => d.confidence === c).length;
  const out = {
    generatedAt: new Date().toISOString(),
    lookbackDays: LOOKBACK_DAYS,
    universe: { count: universe.symbols.length, scanned: symbols.length, asOf: universe.asOf, source: universe.source },
    coverage: {
      symbolsScanned: coverage.symbolsScanned,
      cikResolved: coverage.cikResolved,
      submissionsOk: coverage.submissionsOk,
      filingsScanned: coverage.filingsScanned,
      docsFetched: coverage.docsFetched,
      docsFromCache: coverage.docsFromCache,
      termsRejected: coverage.termsRejected,
      dealsFound: { HIGH: byConf('HIGH'), MEDIUM: byConf('MEDIUM'), LOW: byConf('LOW') },
      errorCount: coverage.errors.length,
    },
    errors: coverage.errors.slice(0, 100),
    deals: uniqueDeals,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
  console.log(`arb miner: symbols=${coverage.symbolsScanned} filings=${coverage.filingsScanned} fetched=${coverage.docsFetched} cached=${coverage.docsFromCache} deals HIGH=${byConf('HIGH')} MEDIUM=${byConf('MEDIUM')} LOW=${byConf('LOW')} errors=${coverage.errors.length}`);
  console.log(`wrote ${path.relative(root, OUT_PATH)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
