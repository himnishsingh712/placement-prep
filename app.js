import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm';
import { SEED } from './seed.js';
import { MODS, BANK, COMPANIES, CAT2MODS, ROLEGROUPS, HRQ, CATLAB } from './content.js';

const SB_URL = 'https://towxfwpgywxbqfrppidu.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvd3hmd3BneXd4YnFmcnBwaWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTM2NTQsImV4cCI6MjExMDU2OTY1NH0.WAsgBwGN3bN46GzMPziMpjmZtHeBrFLh3kaRpV4SfYs';
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const L = v => '₹' + (+v).toFixed(1).replace(/\.0$/, '') + 'L';
const slug = s => String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600) }
function openModal(html) { $('#mbody').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden' }
function closeModal() { $('#modal').hidden = true; document.body.style.overflow = '' }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal() });

/* ---------- global state ---------- */
let USER = null, P = null, S = { c: {}, n: {}, co: {}, h: [] }, CO = [];
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(flush, 800) }
async function flush() { if (!USER) return; const { error } = await sb.from('pp_state').upsert({ user_id: USER.id, state: S, updated_at: new Date().toISOString() }); if (error) toast('Not saved: check your connection') }
async function saveProfile(patch) { Object.assign(P, patch); if (patch.cv) syncPersonal(); const { error } = await sb.from('pp_profiles').upsert({ id: USER.id, ...patch, updated_at: new Date().toISOString() }); if (error) { console.error(error); toast('Could not save profile') } }

/* ---------- topics + items ---------- */
const TOPICS = []; MODS.forEach(m => m.tp.forEach((t, i) => TOPICS.push({ ...t, mod: m.id, id: 't:' + m.id + ':' + (t.k || i), i })));
const topicById = id => TOPICS.find(t => t.id === id);
const modById = id => MODS.find(m => m.id === id);
const bankById = id => BANK.find(b => b.id === id);
const bankOk = b => b && (!b.who || (P && P.preset === b.who));
const subsFor = t => (t.sub || []).filter(id => bankOk(bankById(id)));
const ck = id => !!S.c[id];
function setCk(id, v) { if (v) S.c[id] = Date.now(); else delete S.c[id]; save(); renderAll() }
const nt = (k, d) => S.n[k] != null ? S.n[k] : d;
function tCount(t) { const sb_ = subsFor(t); return t.sub && sb_.length ? [sb_.filter(b => ck('b:' + b)).length, sb_.length] : [ck(t.id) ? 1 : 0, 1] }
const sumT = ts => ts.reduce((a, t) => { const [d, n] = tCount(t); return [a[0] + d, a[1] + n] }, [0, 0]);
function tProg(t) { const sb_ = subsFor(t); if (t.sub && sb_.length) return sb_.filter(b => ck('b:' + b)).length / sb_.length; return ck(t.id) ? 1 : 0 }
const CVP = () => (P && P.cv && P.cv.pointers) || [];
function cvProg(p) { return ['s', 'n', 'k'].filter(x => ck('cv:' + p.id + ':' + x)).length / 3 }

/* ---------- companies ---------- */
const STATUS = ['Awaiting shortlist', 'Shortlisted', 'Interviewing', 'Offer', 'Not shortlisted', 'Rejected', 'Not pursuing', 'Process over'];
const LIVE_ST = ['Awaiting shortlist', 'Shortlisted', 'Interviewing'];
const coById = id => CO.find(c => c.id === id);
const myCo = c => S.co[c.id] || {};
const coSt = c => myCo(c).st || (c.defSt || 'Awaiting shortlist');
const coPr = c => myCo(c).pr || (P.prefs && P.prefs.pr && P.prefs.pr[c.id]) || c.pr || 'P2';
const inPrep = c => { const m = myCo(c); if (m.in != null) return !!m.in; return c.seed !== false && LIVE_ST.includes(coSt(c)) && coPr(c) !== 'Skip' };
const liveCos = () => CO.filter(c => inPrep(c) && LIVE_ST.includes(coSt(c)));
const isSL = c => ['Shortlisted', 'Interviewing'].includes(coSt(c));
const slCos = () => liveCos().filter(isSL);
const PRW = { P1: 3, P2: 1.2, P3: 0.6, Skip: 0 };
function wt(c) { if (!inPrep(c)) return 0; const st = coSt(c); const m = isSL(c) ? 10 : st === 'Awaiting shortlist' ? 1 : 0; return (PRW[coPr(c)] ?? 1) * Math.max(0.5, Math.min(1.6, val(c) / 20)) * m }
function topicsFor(c) { return TOPICS.filter(t => c.mods.includes(t.mod) && (!t.co || t.co.includes(c.id)) && (!t.only || t.only.includes(c.id))) }
function cvFor(c) {
  const map = P.cv && P.cv.map && P.cv.map[c.id]; if (map) return map.filter(id => CVP().find(p => p.id === id));
  const kw = (c.kw || []).concat((c.jd || []).join(' ').toLowerCase().match(/[a-z]{5,}/g) || []);
  const sc = CVP().map(p => { const txt = (p.t + ' ' + (p.k || '')).toLowerCase(); return [p.id, kw.filter(k => txt.includes(k)).length] }).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  return sc.slice(0, 7).map(x => x[0])
}
function itemsFor(c) { const [td, tn] = sumT(topicsFor(c)); const cv = cvFor(c).map(id => cvProg(CVP().find(p => p.id === id))); return { done: td + cv.reduce((a, b) => a + b, 0) + (ck('co:' + c.id + ':why') ? 1 : 0), total: tn + cv.length + 1 } }
function allItems() { const [td, tn] = sumT(TOPICS.filter(t => !t.co || liveCos().some(c => t.co.includes(c.id)))); const cv = CVP().map(cvProg); const w = liveCos().map(c => ck('co:' + c.id + ':why') ? 1 : 0); return { done: td + cv.reduce((a, b) => a + b, 0) + w.reduce((a, b) => a + b, 0), total: tn + cv.length + w.length } }
const pct = r => Math.round(r.done / Math.max(1, r.total) * 100);

/* ---------- EOI model (logistic, Bayesian prior; from the EOI or EONI? trainer) ---------- */
const TIER = {}; SEED.LIB.forEach(c => { TIER[c[0].toLowerCase()] = c[1] });
function tierOf(name) { const n = String(name || '').toLowerCase().trim(); if (!n) return 'unknown'; if (TIER[n]) return TIER[n]; const k = Object.keys(TIER).find(k => n.includes(k) || k.includes(n)); return k ? TIER[k] : 'unknown' }
const NCR = ['gurgaon', 'gurugram', 'delhi', 'delhi ncr', 'noida', 'ncr'];
const cityKey = c => { const s = String(c || '').toLowerCase(); if (/kolkata|chennai/.test(s)) return 'kc'; if (NCR.some(x => s.includes(x))) return 'ncr'; if (s.includes('mumbai')) return 'mum'; if (/bangalore|bengaluru/.test(s)) return 'blr'; if (/pan|choice/.test(s)) return 'pan'; return 'oth' };
const FN = ['base', 'fixed pay', 'big name', 'super brand', 'NCR', 'Mumbai', 'Bangalore', 'other city', 'sales/ops role', 'media/research role', '6-day week', 'late in season', 'Kolkata/Chennai', 'lesser-known company'];
function fx(c) {
  const t = c.tier || tierOf(c.company); const ck_ = cityKey(c.city);
  return [1, (+c.fixed || 0) - 18, +(t === 'top' || t === 'super'), +(t === 'super'), +(ck_ === 'ncr'), +(ck_ === 'mum'), +(ck_ === 'blr'), +(ck_ === 'oth'),
    +['b2b', 'field', 'finance', 'gm', 'cs'].includes(c.cat), +['media', 'research'].includes(c.cat), +!!c.six, +!!c.late, +(ck_ === 'kc'), +(t === 'unknown')]
}
const M0 = [1.3, 1.8, .7, .4, .4, -.2, -.2, -.4, 0, -.8, -1, -.2, -3, -.6], S0 = [1.5, .7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1];
const K = M0.length;
const sig = z => 1 / (1 + Math.exp(-z));
function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++)if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;[M[i], M[p]] = [M[p], M[i]]; for (let r = 0; r < n; r++)if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++)M[r][c] -= f * M[i][c] } } return M.map((r, i) => r[n] / r[i]) }
function fit(rows, prior) {
  const mu = prior || M0; let b = mu.slice();
  for (let it = 0; it < 15; it++) {
    const g = b.map((v, k) => (v - mu[k]) / S0[k] ** 2); const H = b.map((_, i) => b.map((_, j) => i === j ? 1 / S0[i] ** 2 : 0));
    for (const [x, y, w] of rows) { const p = sig(x.reduce((s, v, k) => s + v * b[k], 0)); for (let i = 0; i < K; i++) { g[i] += w * (p - y) * x[i]; for (let j = 0; j < K; j++)H[i][j] += w * p * (1 - p) * x[i] * x[j] } }
    const d = solve(H, g); b = b.map((v, k) => v - d[k]); if (d.reduce((s, v) => s + Math.abs(v), 0) < 1e-6) break
  }
  return b
}
function priorFromPrefs(pf) {
  if (!pf || !pf.floor) return M0.slice();
  const m = M0.slice(); m[0] = 1.8 * (18 - pf.floor); const br = pf.brand || 2; m[2] = .25 + .25 * br; m[3] = .15 * br;
  const cv = { love: .6, ok: 0, meh: -.8, never: -4 }; const cp = pf.cities || {};
  m[4] = cv[cp.ncr || 'ok']; m[5] = cv[cp.mum || 'ok']; m[6] = cv[cp.blr || 'ok']; m[7] = cv[cp.oth || 'ok'] - .2; m[12] = cv[cp.kc || 'meh'] - 1;
  m[10] = pf.six === 'never' ? -4 : pf.six === 'fine' ? -.2 : -1.2; m[8] = (pf.avoid || []).some(r => ['field', 'b2b', 'finance'].includes(r)) ? (pf.rtier ? -.5 : -1) : 0;
  return m
}
let MODEL = null;
function model() { if (MODEL) return MODEL; const rows = (P.eoi_rows || []).map(r => [r[0], r[1], r[2]]); MODEL = fit(rows, priorFromPrefs(P.prefs)); return MODEL }
function rolePref(cat) { const pf = P.prefs || {}; if (pf.rtier && pf.rtier[cat]) return pf.rtier[cat] === 'T1' ? .5 : pf.rtier[cat] === 'T3' ? -.6 : 0; let o = 0; if ((pf.roles || []).includes(cat)) o += .5; if ((pf.avoid || []).includes(cat)) o -= 1.5; return o }
function val(c) { const b = model(); const x = fx({ company: c.name, tier: c.tier, fixed: c.fixed || (c.ctc || 18) * .85, city: c.city || 'Gurgaon', cat: c.rt }); const z = x.reduce((s, v, k) => s + v * b[k], 0) + rolePref(c.rt); return 18 + z / Math.max(.6, b[1]) }
const band = v => v >= 24 ? 'Super dream' : v >= 20 ? 'Dream' : v >= 18 ? 'Good' : v >= 16 ? 'Below floor' : 'Weak';

/* ---------- role category detection ---------- */
const CATKW = [['consult', /consult|strategy analyst|advisory/], ['product', /product (manager|marketing)|\bapm\b|\bpmm\b/], ['cs', /customer success|client success|account manager/], ['digital', /digital|performance|seo|sem|paid media/], ['growth', /growth|acquisition|retention/], ['category', /category|merchandis/], ['brand', /brand|marketing manager|marketing/], ['mt', /trainee|\bmt\b|leadership program|rotational|graduate/], ['b2b', /key account|enterprise sales|b2b|business development|sales manager/], ['field', /area sales|territory|sales officer|field/], ['finance', /branch|relationship manager|credit|loan/], ['media', /media|planner|agency|client servicing/], ['research', /research|insight/], ['gm', /operations|business manager|\bops\b/]];
function detectCat(role, jd) { const r = String(role || '').toLowerCase(); for (const [k, re] of CATKW) if (re.test(r)) return k; const j = String(jd || '').toLowerCase().slice(0, 1500); for (const [k, re] of CATKW) if (re.test(j)) return k; return 'brand' }

/* ---------- JD reading (free, on device) ---------- */
async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise; let out = '';
    for (let i = 1; i <= Math.min(doc.numPages, 15); i++) { const pg = await doc.getPage(i); const tc = await pg.getTextContent(); out += tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n' }
    if (out.replace(/\s+/g, '').length < 150) throw new Error('This PDF is a scanned image, so the app can\'t read its text. Upload the Word (.docx) file instead, or in Word / Google Docs use File → Download → PDF and upload that.');
    return out
  }
  if (name.endsWith('.docx')) {
    if (!window.mammoth) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) });
    const r = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() }); return r.value
  }
  if (name.endsWith('.txt')) return await file.text();
  throw new Error('Use a PDF or .docx file')
}
const SKILLS = [['Google Ads / paid search', /google ads|paid search|\bsem\b|search ads|ppc/], ['Meta / social ads', /meta ads|facebook|instagram|social media ads|paid social/], ['Performance marketing', /performance marketing|roas|cpa|cac|conversion/], ['Analytics & dashboards', /analytic|dashboard|ga4|google analytics|looker|power bi|tableau|excel/], ['SEO / content', /\bseo\b|content strategy|organic/], ['Campaign management', /campaign/], ['Brand management', /brand (management|building|strategy)|positioning|brand equity/], ['Consumer insight / research', /consumer insight|market research|primary research|survey|focus group/], ['GTM / launches', /go-to-market|\bgtm\b|launch/], ['Sales enablement', /sales enablement|pitch deck|battlecard|collateral/], ['B2B / ABM / pipeline', /\bb2b\b|account-based|\babm\b|pipeline|lead gen|mql|sql/], ['Stakeholder management', /stakeholder|cross-functional|cross functional/], ['Client / account management', /client management|account management|client-facing|client relationship/], ['Customer success / retention', /customer success|retention|churn|renewal|nrr|adoption/], ['Trade / channel / distribution', /distributor|distribution|trade marketing|general trade|modern trade|channel partner|retail/], ['Field sales', /field|territory|beat|counter/], ['Category / P&L', /category|p&l|assortment|margin/], ['Project management', /project management|multi-quarter|program management/], ['ERP / enterprise platforms', /sap|s\/4hana|oracle|workday|salesforce|erp/], ['Process mapping / business analysis', /process (mapping|analysis)|fit-gap|requirements|business analysis|r2r|p2p|o2c/], ['Change management', /change management|adoption|training/], ['AI / GenAI', /\bai\b|genai|generative|machine learning|llm|agentic/], ['Market sizing / strategy', /market sizing|market entry|strategy|competitive/], ['Events / community', /event|webinar|community/], ['Agency coordination', /agency|agencies/]];
function jdFit(jd) {
  const j = String(jd || '').toLowerCase(); const asked = SKILLS.filter(s => s[1].test(j));
  const cvt = CVP().map(p => (p.t + ' ' + (p.k || '')).toLowerCase()).join(' ') + ' ' + String(P.resume_text || '').toLowerCase();
  const have = asked.filter(s => s[1].test(cvt)); const gap = asked.filter(s => !s[1].test(cvt));
  const ptr = CVP().map(p => { const t = (p.t + ' ' + (p.k || '')).toLowerCase(); return [p, asked.filter(s => s[1].test(t)).length] }).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x[0]);
  return { asked: asked.map(s => s[0]), have: have.map(s => s[0]), gap: gap.map(s => s[0]), fit: asked.length ? Math.round(have.length / asked.length * 100) : null, ptr }
}
function phaseNow() { const d = todayIST(); if (d <= '2026-12-10') return ['dream window', 'Offers in the first ~4 weeks after 18 Nov have averaged ₹21–29L. Waiting costs about 11% of CTC per week in this window.']; if (d <= '2026-12-20') return ['main season ending', 'The dream window is closing; offers now average closer to ₹18L.']; return ['roll-overs', 'Roll-over offers have averaged about ₹16L in past seasons.'] }
function stillToCome() { const here = new Set(CO.map(c => c.name.toLowerCase())); return SEED.comp.filter(c => !c[4] && c[2] >= .55 && !here.has(c[0].toLowerCase())).sort((a, b) => b[2] - a[2]).slice(0, 6) }

function verdict(inp) {
  const b = model(); const x = fx(inp); let z = x.reduce((s, v, k) => s + v * b[k], 0) + rolePref(inp.cat); let p = sig(z); const reasons = [];
  const pf = P.prefs || {}; const ckk = cityKey(inp.city);
  let veto = null;
  if (ckk === 'kc' && (pf.cities ? pf.cities.kc === 'never' : true)) veto = 'Kolkata/Chennai is one of your stated deal-breakers.';
  if (pf.cities && pf.cities[ckk] === 'never' && ckk !== 'kc') veto = 'This city is on your never list.';
  if (inp.six && pf.six === 'never') veto = 'A 6-day week is a deal-breaker for you.';
  if ((pf.avoid || []).includes(inp.cat) && pf.avoidHard) veto = 'This role type is on your avoid list.';
  if (veto) p = Math.min(p, .05);
  // contributions vs a neutral card
  const contrib = x.map((v, k) => [k, v * b[k]]).filter(([k, v]) => k > 0 && Math.abs(v) >= .25).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1])).slice(0, 4);
  const d = (+inp.fixed - 18);
  contrib.forEach(([k, v]) => {
    let t = '';
    if (k === 1) t = `${L(inp.fixed)} fixed is ${d >= 0 ? L(d) + ' above' : L(-d) + ' below'} the ₹18L line, and fixed pay carries the most weight in your choices.`;
    else if (k === 2) t = 'A big-name brand: your past answers accept a lower fixed for names like this.';
    else if (k === 3) t = 'A super brand: this lifts it a lot for you.';
    else if (k === 13) t = 'A lesser-known company: you usually want more pay to say yes.';
    else if (k === 10) t = 'The 6-day week is a heavy minus in your answers (worth about ₹2–3L).';
    else if (k === 12) t = 'Kolkata/Chennai counts strongly against it for you.';
    else if (k === 8) t = 'Sales/ops-heavy role: a mild minus in your answers.';
    else if (k === 9) t = 'Media/research roles count against it in your answers.';
    else if ([4, 5, 6, 7].includes(k)) t = `${FN[k]} location: ${v > 0 ? 'a plus' : 'a minus'} for you.`;
    else if (k === 11) t = 'Late in the season: it barely changes your bar.';
    if (t) reasons.push([v > 0 ? '+' : '−', t])
  });
  if (rolePref(inp.cat) > 0) reasons.push(['+', `${CATLAB[inp.cat] || inp.cat} is a role type you want.`]);
  if (rolePref(inp.cat) < 0) reasons.push(['−', `${CATLAB[inp.cat] || inp.cat} is a role type you'd rather avoid.`]);
  if (inp.bond) reasons.push(['−', 'Service bond: check its length and penalty before you EOI.']);
  const jf = jdFit(inp.jd); const ph = phaseNow(); const tc = stillToCome();
  const yes = p >= .5; const conf = Math.min(95, Math.round((yes ? p : 1 - p) * 100)); const close = p > .35 && p < .65;
  const worth = 18 + (z) / Math.max(.6, b[1]);
  let insight = '';
  if (veto) insight = veto + ' Unless something has changed, skip it.';
  else if (close) insight = `This is a close call for you (about ${Math.round(p * 100)}% EOI). It's worth roughly ${L(worth)} Gurgaon-equivalent fixed by your own rules. ${ph[0] === 'dream window' ? 'You are in the dream window, so ask: would getting placed here stop you sitting for a company you want more in the next 2–3 weeks?' : 'The dream window is over, so locking in matters more now.'}`;
  else if (yes) insight = `Your past choices say yes: it's worth about ${L(worth)} Gurgaon-equivalent fixed to you, ${worth >= 20 ? 'in your dream band' : worth >= 18 ? 'above your floor' : 'just around your floor'}.`;
  else insight = `Your past choices say no: it's worth about ${L(worth)} Gurgaon-equivalent fixed to you, below the ₹18L line you usually hold.`;
  if (jf.fit != null) insight += ` The JD asks for ${jf.asked.length} skills you can match to your CV; you cover ${jf.have.length}${jf.gap.length ? ' (gaps: ' + jf.gap.slice(0, 3).join(', ') + ')' : ''}.`;
  return { p, yes, conf, close, veto, reasons, jf, ph, tc, worth, insight, x }
}

/* ---------- AI (mock interviews, resume parsing) ---------- */
async function ai(task, payload) {
  const { data } = await sb.auth.getSession(); const tok = data.session && data.session.access_token;
  const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ task, payload }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'AI unavailable'); e.code = j.code || r.status; throw e } return j
}


/* ---------- personal CV practice (per user) ---------- */
const PERS_SETS = { cvcase: 'case', setH: 'guess', setC: 'guess' };
let _origSubs = null;
function cvTemplates() {
  const ps = CVP().filter(p => /\d/.test(p.t)).slice(0, 10); const out = [];
  ps.forEach((p, i) => {
    const line = p.t.length > 140 ? p.t.slice(0, 140).replace(/\s+\S*$/, '') + '…' : p.t;
    out.push({ id: 'u_tc' + i, kind: 'case', cat: 'From your CV', src: 'cv', co: [], q: `Your CV says: "${line}". Do the same for us: how would you run this for our company?`, how: `<p><b>How to answer:</b> restate the goal in one line, then: (1) what you did and the result, with the number explained; (2) how our situation differs (customers, scale, channels); (3) your plan in three steps; (4) the metric you'd track and a 90-day target.</p><p><b>Prepare:</b> know where every number on this line came from, and one thing you'd do differently now.</p>` });
    if (i < 6) out.push({ id: 'u_tg' + i, kind: 'guess', cat: 'From your CV', src: 'cv', co: [], q: `From "${line}": estimate the size of the market or volume behind this work (customers, users or spend in India per year).`, how: `<p>Pick the unit (people, businesses, transactions, rupees). Go top-down: population or businesses → the relevant segment → who buys or uses → how often → price. Then check bottom-up from something you saw on the job (one client, one store, one campaign × how many exist). Say the answer, then one line on what it means for the company asking.</p>` });
  });
  return out;
}
function syncPersonal() {
  const allT = MODS.flatMap(m => m.tp);
  if (!_origSubs) { _origSubs = {}; allT.forEach(t => { if (PERS_SETS[t.k]) _origSubs[t.k] = [...(t.sub || [])] }) }
  for (let i = BANK.length - 1; i >= 0; i--) if (BANK[i].mine) BANK.splice(i, 1);
  const own = ((P.cv && P.cv.bank) || []).map((b, i) => ({ src: 'cv', co: [], cat: 'From your CV', ...b, id: 'u_' + (b.id || i), mine: true })).filter(b => b.q && b.how && (b.kind === 'case' || b.kind === 'guess'));
  const hasOwnCV = P.preset === 'himnish' || own.length;
  const list = own.length ? own : (hasOwnCV ? [] : cvTemplates().map(b => ({ ...b, mine: true })));
  BANK.push(...list);
  allT.forEach(t => { if (!PERS_SETS[t.k]) return; const kind = PERS_SETS[t.k]; const nx = [..._origSubs[t.k], ...(t.k === 'setC' ? [] : list.filter(b => b.kind === kind).map(b => b.id))]; t.sub.length = 0; t.sub.push(...nx) });
}


function importPrompt() {
  const cos = liveCos().map(c => `${c.id} = ${c.name}${c.role ? ' (' + c.role + ')' : ''}`).join('; ');
  const hr = HRQ.map(q => `${q[0]} = "${q[1]}"`).join('; ');
  return `I'm preparing for MBA placement interviews (MICA, PGP). Using my attached resume (and any CV critique notes I paste), build my interview prep. Be specific to my real experience; don't invent numbers, and where something is unclear, write [CHECK] instead of guessing.

Reply with ONLY one JSON object (no other text) in exactly this shape:
{
 "pointers": [ { "id": "P1", "s": "Company · role (dates)", "t": "the CV line", "k": "key terms to know for this line",
   "q": ["5 likely interviewer questions on this line"],
   "defend": "one or two lines on how to explain the number or my role honestly",
   "star": [["Situation","..."],["Task","..."],["Action","..."],["Result","..."]] } ],
 "map": { "companyId": ["P1","P3"] },
 "hr": { "questionId": "my answer, natural and spoken, 60–90 seconds, first person" },
 "bank": [ { "id": "c1", "kind": "case", "cat": "From your CV", "co": ["companyId"], "q": "a case an interviewer could build from my CV", "how": "<p>how to solve it, step by step, with numbers</p>" },
           { "id": "g1", "kind": "guess", "cat": "From your CV", "co": [], "q": "a guesstimate from my CV, skills or hobbies", "how": "<p>worked answer, top-down or bottom-up, with a cross-check</p>" } ]
}

Rules: one pointer per CV line that an interviewer could ask about (all of them). STAR for every pointer, written as I'd say it aloud, not as a fairy tale and not robotic. 6–8 cases and 6–8 guesstimates in "bank" (mix of top-down and bottom-up). The "how" fields may use simple HTML (<p>, <ul>, <li>, <b>).
Company ids for "map" and "co": ${cos || 'none yet'}.
HR question ids: ${hr}.`;
}
function parseImport(txt) {
  const a = txt.indexOf('{'), b = txt.lastIndexOf('}'); if (a < 0 || b < a) return { err: 'I could not find the JSON. Paste Claude\'s whole reply.' };
  let d; try { d = JSON.parse(txt.slice(a, b + 1)) } catch (e) { return { err: 'The reply is not valid JSON. Ask Claude: "Return only the JSON, nothing else", then paste again.' } }
  const clean = h => String(h || '').replace(/<\s*(script|iframe|style|object|embed)[\s\S]*?>[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '');
  const str = x => typeof x === 'string' ? x : '';
  const cv = {};
  if (Array.isArray(d.pointers) && d.pointers.length) cv.pointers = d.pointers.filter(p => p && str(p.t)).slice(0, 80).map((p, i) => ({ id: str(p.id) || 'P' + (i + 1), s: str(p.s) || 'Resume', t: str(p.t), k: str(p.k), q: Array.isArray(p.q) ? p.q.map(str).filter(Boolean).slice(0, 8) : [], defend: str(p.defend), star: Array.isArray(p.star) ? p.star.filter(x => Array.isArray(x) && x.length === 2).map(x => [str(x[0]), str(x[1])]) : undefined }));
  if (d.map && typeof d.map === 'object') { cv.map = {}; Object.entries(d.map).forEach(([k, v]) => { if (Array.isArray(v)) cv.map[k] = v.map(str).filter(Boolean) }) }
  if (d.hr && typeof d.hr === 'object') { cv.hr = { ...((P.cv && P.cv.hr) || {}) }; Object.entries(d.hr).forEach(([k, v]) => { if (str(v)) cv.hr[k] = '<p>' + esc(str(v)).replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>') + '</p>' }) }
  if (Array.isArray(d.bank)) cv.bank = d.bank.filter(x => x && (x.kind === 'case' || x.kind === 'guess') && str(x.q) && str(x.how)).slice(0, 30).map((x, i) => ({ id: str(x.id) || 'b' + i, kind: x.kind, cat: str(x.cat) || 'From your CV', co: Array.isArray(x.co) ? x.co.map(str) : [], q: str(x.q), how: clean(x.how) }));
  if (!cv.pointers && !cv.hr && !cv.bank) return { err: 'Nothing to import: the JSON has no pointers, hr or bank.' };
  return { cv };
}

/* ---------- boot ---------- */
let RECOVERY = /type=recovery/.test(location.hash);
async function boot() {
  const { data } = await sb.auth.getSession();
  if (RECOVERY || /type=recovery/.test(location.hash)) return showNewPassword();
  if (!data.session) return showAuth();
  USER = data.session.user; await loadAll();
}
sb.auth.onAuthStateChange((ev, session) => { if (ev === 'PASSWORD_RECOVERY') { RECOVERY = true; showNewPassword(); return } if (ev === 'SIGNED_OUT') { USER = null; location.hash = ''; showAuth() } });
async function loadAll() {
  const [pr, st, co] = await Promise.all([
    sb.from('pp_profiles').select('*').eq('id', USER.id).maybeSingle(),
    sb.from('pp_state').select('state').eq('user_id', USER.id).maybeSingle(),
    sb.from('pp_companies').select('id,data')]);
  P = pr.data || { id: USER.id, prefs: {}, eoi_rows: [] }; P.prefs = P.prefs || {}; P.eoi_rows = P.eoi_rows || [];
  S = Object.assign({ c: {}, n: {}, co: {}, h: [] }, (st.data && st.data.state) || {});
  const shared = {}; (co.data || []).forEach(r => shared[r.id] = r.data);
  const missing = COMPANIES.filter(c => !shared[c.id]);
  if (missing.length) { await sb.from('pp_companies').insert(missing.map(c => ({ id: c.id, data: c, created_by: USER.id }))).then(() => { }); missing.forEach(c => shared[c.id] = c) }
  const code = Object.fromEntries(COMPANIES.map(c => [c.id, c]));
  CO = Object.values(shared).map(c => { const k = code[c.id]; const m = k ? { ...k, ...c, mods: [...new Set([...(k.mods || []), ...(c.mods || [])])] } : c; return { mods: ['story'], jd: [], expect: [], ask: [], kw: [], ...m } });
  CO.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  MODEL = null; syncPersonal();
  $('#boot').hidden = true; $('#auth').hidden = true;
  if (!P.onboarded) return showOnboarding();
  $('#onb').hidden = true; $('#app').hidden = false; if (!S.plan0) { S.plan0 = P.preset === 'himnish' ? '2026-11-22' : todayIST(); save() }
  route()
}

/* ---------- auth ---------- */
function authShell(inner) {
  $('#boot').hidden = true; $('#app').hidden = true; $('#onb').hidden = true; const a = $('#auth'); a.hidden = false;
  a.innerHTML = `<div style="max-width:420px;margin:10vh auto 0;padding:0 4px"><h1>Placement prep</h1>${inner}
  <p class="note mt">On iPhone: open this page in Safari, tap Share, then Add to Home Screen. On Android: open in Chrome, tap ⋮, then Install app or Add to Home screen.</p></div>`;
}
const pwField = (id, ac, ph) => `<label class="f" for="${id}">Password</label><input id="${id}" type="password" autocomplete="${ac}" placeholder="${ph}"><label class="note" style="display:flex;gap:6px;align-items:center;margin-top:4px"><input type="checkbox" data-show="${id}" style="width:auto"> Show password</label>`;
function wireShow() { document.querySelectorAll('[data-show]').forEach(c => c.onchange = () => { $('#' + c.dataset.show).type = c.checked ? 'text' : 'password' }) }
function authMsg(m) { const r = m || ''; if (/invalid login/i.test(r)) return 'That email and password don\'t match an account. If you made an account earlier (even in another app of yours that uses the same login), use that password, or tap Forgot password.'; if (/rate limit/i.test(r)) return 'Too many attempts in a short time. Wait a few minutes and try again.'; if (/already registered|already exists/i.test(r)) return 'This email already has an account. Sign in instead, or tap Forgot password.'; if (/failed to fetch|network/i.test(r)) return 'No internet connection. Check your network and try again.'; return r }
function showAuth(mode) {
  mode = mode || 'in'; const up = mode === 'up';
  authShell(`<p class="sub">${up ? 'Create your account. Use any email and a password you\'ll remember.' : 'Sign in to your account.'}</p>
  <div class="panel mt"><label class="f" for="em">Email</label><input id="em" type="email" autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false">
  ${pwField('pw', up ? 'new-password' : 'current-password', 'At least 6 characters')}
  <div class="row2 mt"><button class="pri" id="go">${up ? 'Create account' : 'Sign in'}</button><span class="sp"></span>${up ? '' : '<button id="fp">Forgot password</button>'}</div><p class="note" id="am" role="status"></p>
  <p class="note mt">${up ? 'Already have an account? <a href="javascript:void 0" id="sw">Sign in</a>' : 'New here? <a href="javascript:void 0" id="sw">Create an account</a>'}</p></div>`);
  wireShow(); $('#sw').onclick = () => showAuth(up ? 'in' : 'up');
  const val = () => { const email = $('#em').value.trim().toLowerCase(), password = $('#pw').value; if (!/^\S+@\S+\.\S+$/.test(email)) { $('#am').textContent = 'Enter a valid email address.'; return null } return { email, password } };
  const go = async () => {
    const v = val(); if (!v) return; if (v.password.length < 6) { $('#am').textContent = 'The password needs at least 6 characters.'; return }
    $('#go').disabled = true; $('#am').textContent = up ? 'Creating your account…' : 'Signing in…';
    try {
      let r;
      if (up) {
        r = await sb.auth.signUp({ email: v.email, password: v.password });
        if (!r.error && r.data.user && Array.isArray(r.data.user.identities) && r.data.user.identities.length === 0) { $('#am').textContent = 'This email already has an account. Tap Sign in below and use its password, or use Forgot password.'; return }
        if (!r.error && !r.data.session) r = await sb.auth.signInWithPassword(v);
      } else r = await sb.auth.signInWithPassword(v);
      if (r.error) { $('#am').textContent = authMsg(r.error.message); return }
      USER = r.data.session.user; $('#auth').hidden = true; $('#boot').hidden = false; await loadAll()
    } catch (e) { $('#am').textContent = authMsg(e.message) } finally { const b = $('#go'); if (b) b.disabled = false }
  };
  $('#go').onclick = go; $('#pw').onkeydown = e => { if (e.key === 'Enter') go() };
  if ($('#fp')) $('#fp').onclick = async () => {
    const email = $('#em').value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) { $('#am').textContent = 'Type your email above first, then tap Forgot password.'; return }
    $('#am').textContent = 'Sending…'; const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' });
    $('#am').textContent = error ? authMsg(error.message) : 'Check your email for a reset link (also the spam folder). Open it on this phone; it brings you back here to set a new password.';
  };
}
function showNewPassword() {
  authShell(`<p class="sub">Set a new password.</p><div class="panel mt">${pwField('np', 'new-password', 'At least 6 characters')}<div class="row2 mt"><button class="pri" id="npGo">Save password</button></div><p class="note" id="am" role="status"></p></div>`);
  wireShow();
  $('#npGo').onclick = async () => {
    const pw = $('#np').value; if (pw.length < 6) { $('#am').textContent = 'At least 6 characters.'; return }
    $('#am').textContent = 'Saving…'; const { data, error } = await sb.auth.updateUser({ password: pw });
    if (error) { $('#am').textContent = authMsg(error.message) + ' If the link expired, request a new one.'; return }
    RECOVERY = false; history.replaceState(null, '', location.pathname); USER = data.user; $('#auth').hidden = true; $('#boot').hidden = false; await loadAll()
  };
}

/* ---------- onboarding ---------- */
let OB = { step: 0 };
function showOnboarding() { if (!OB.edit && OB.step < 2 && P.preset && P.cv && P.cv.pointers && P.cv.pointers.length) OB.step = 2; $('#app').hidden = true; const o = $('#onb'); o.hidden = false; obRender() }
function obRender() {
  const o = $('#onb'); const s = OB.step;
  const head = (n, t, d) => `<div style="max-width:640px;margin:0 auto;padding-top:calc(24px + env(safe-area-inset-top))"><div class="muted">Step ${n} of 5</div><h1>${t}</h1><p class="sub">${d}</p>`;
  if (s === 0) {
    o.innerHTML = head(1, 'Welcome', 'Takes about 10 minutes. After this, the whole app is set up around you.') + `<div class="panel mt"><label class="f" for="obn">Your first name</label><input id="obn" type="text" value="${esc(P.name || '')}">
    <details class="mt"><summary>Have a setup code from Claude?</summary><p class="note">If your profile was prepared in advance, enter the code to load it and skip the setup.</p><div class="row2"><input id="obc" type="text" style="max-width:220px" autocapitalize="characters"><button id="obcGo">Use code</button></div><p class="note" id="obcM"></p></details>
    <div class="row2 mt"><span class="sp"></span><button class="pri" id="obNext">Next</button></div></div></div>`;
    $('#obNext').onclick = async () => { const n = $('#obn').value.trim(); if (!n) return; await saveProfile({ name: n }); OB.step = 1; obRender() };
    $('#obcGo').onclick = async () => { const code = $('#obc').value.trim(); if (!code) return; $('#obcM').textContent = 'Checking…'; const { data, error } = await sb.rpc('pp_claim_preset', { p_code: code }); if (error || !data) { $('#obcM').textContent = 'That code did not work.'; return } $('#obcM').textContent = 'Loaded. Opening…'; setTimeout(() => location.reload(), 400) };
    return
  }
  if (s === 1) {
    o.innerHTML = head(2, 'Your resume', 'One resume per account. The app reads it once and turns every line into a CV-board pointer with the questions you are likely to get.') + `<div class="panel mt"><label class="f" for="obf">Resume (PDF or .docx)</label><input id="obf" type="file" accept=".pdf,.docx">
    <p class="note">Tip: later, in Me, you can build full STAR stories, HR answers and CV-based cases with your own Claude account, for free.</p><p class="note" id="obfM"></p><div id="obfOut"></div><div class="row2 mt"><button class="ghost" id="obBack">Back</button><span class="sp"></span><button class="pri" id="obNext" ${P.cv && P.cv.pointers ? '' : 'disabled'}>Next</button></div></div></div>`;
    if (P.cv && P.cv.pointers) $('#obfOut').innerHTML = cvPreview();
    $('#obBack').onclick = () => { OB.step = 0; obRender() }; $('#obNext').onclick = () => { OB.step = 2; obRender() };
    $('#obf').onchange = async e => {
      const f = e.target.files[0]; if (!f) return; $('#obfM').textContent = 'Reading your resume…';
      try { const txt = await readFile(f); $('#obfM').textContent = 'Breaking it into pointers (about 20 seconds)…';
        let cv; try { const r = await ai('parse_resume', { text: txt.slice(0, 14000) }); cv = r.cv } catch (er) { cv = naiveParse(txt); $('#obfM').textContent = 'AI is not set up yet, so I split your resume line by line. You can refine it later in Me.' }
        await saveProfile({ resume_text: txt.slice(0, 20000), cv }); $('#obfOut').innerHTML = cvPreview(); $('#obNext').disabled = false; if (!$('#obfM').textContent.startsWith('AI')) $('#obfM').textContent = 'Done. Check the pointers below.'
      } catch (er) { $('#obfM').textContent = er.message || 'Could not read that file.' }
    };
    return
  }
  if (s === 2) {
    const pf = P.prefs || {}; const cats = ['brand', 'mt', 'digital', 'growth', 'product', 'category', 'consult', 'cs', 'b2b', 'field', 'media', 'research', 'finance', 'gm'];
    const multi = (id, sel) => `<div class="seg" data-multi="${id}">${cats.map(c => `<button class="sm${(sel || []).includes(c) ? ' on' : ''}" data-v="${c}">${esc(CATLAB[c])}</button>`).join('')}</div>`;
    const cityRow = (k, lab) => `<div class="row2" style="margin:6px 0"><b style="width:9em;font-weight:500">${lab}</b><div class="seg" data-one="city_${k}">${[['love', 'Love'], ['ok', 'Fine'], ['meh', 'Prefer not'], ['never', 'Never']].map(([v, l]) => `<button class="sm${((pf.cities || {})[k] || (k === 'kc' ? 'meh' : 'ok')) === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
    o.innerHTML = head(3, 'What you want', 'Quick answers. These set your starting EOI rules; the hard cards in step 5 fine-tune them.') + `<div class="panel mt">
    <label class="f">Rank each role type</label><p class="note" style="margin-top:0">Tier 1: what you most want. Tier 2: happy to do. Tier 3: only if the pay or brand is great. Nothing is ruled out.</p>
    ${cats.map(c => { const cur = (pf.rtier || {})[c] || ((pf.roles || []).includes(c) ? 'T1' : (pf.avoid || []).includes(c) ? 'T3' : 'T2'); return `<div class="row2" style="margin:6px 0;flex-wrap:nowrap"><span style="flex:1;font-size:14px">${esc(CATLAB[c])}</span><div class="seg" data-one="rt_${c}" style="flex:none">${['T1', 'T2', 'T3'].map(v => `<button class="sm${cur === v ? ' on' : ''}" data-v="${v}">${v.replace('T', 'Tier ')}</button>`).join('')}</div></div>` }).join('')}
    <label class="f">Lowest fixed pay you'd EOI for at a mid-tier company, in your best city: <b id="flv">${L(pf.floor || 17.5)}</b></label><input id="fl" type="range" min="13" max="24" step=".5" value="${pf.floor || 17.5}" style="width:100%;accent-color:var(--pink)">
    <label class="f">Cities</label>${cityRow('ncr', 'Delhi NCR')}${cityRow('mum', 'Mumbai')}${cityRow('blr', 'Bangalore')}${cityRow('oth', 'Pune / Hyderabad / others')}${cityRow('kc', 'Kolkata / Chennai')}
    <label class="f">How much does the brand name matter against pay?</label><div class="seg" data-one="brand">${[[1, 'Pay first'], [2, 'Balanced'], [3, 'Brand matters a lot'], [4, 'Brand first']].map(([v, l]) => `<button class="sm${(pf.brand || 2) === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <label class="f">A 6-day work week is…</label><div class="seg" data-one="six">${[['never', 'A deal-breaker'], ['heavy', 'A heavy minus'], ['fine', 'Fine']].map(([v, l]) => `<button class="sm${(pf.six || 'heavy') === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <label class="f">What matters most? (pick up to 2)</label><div class="seg" data-multi="most">${['Pay', 'Brand', 'Role', 'City', 'Learning', 'Work-life'].map(v => `<button class="sm${(pf.most || []).includes(v) ? ' on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
    <label class="f" for="goal">Your goal for the season, in a line</label><input id="goal" type="text" value="${esc(pf.goal || '')}" placeholder="e.g. Brand role at a top FMCG, Gurgaon or Mumbai">
    <div class="row2 mt"><button class="ghost" id="obBack">Back</button><span class="sp"></span><button class="pri" id="obNext">Next</button></div></div></div>`;
    const tmp = JSON.parse(JSON.stringify(pf)); tmp.cities = tmp.cities || {};
    o.querySelectorAll('[data-multi]').forEach(g => g.onclick = e => { const b = e.target.closest('button'); if (!b) return; const k = g.dataset.multi; tmp[k] = tmp[k] || []; const v = b.dataset.v; const i = tmp[k].indexOf(v); if (i >= 0) tmp[k].splice(i, 1); else { if (k === 'most' && tmp[k].length >= 2) return; tmp[k].push(v) } b.classList.toggle('on') });
    o.querySelectorAll('[data-one]').forEach(g => g.onclick = e => { const b = e.target.closest('button'); if (!b) return; const k = g.dataset.one; g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); const v = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; if (k.startsWith('city_')) tmp.cities[k.slice(5)] = v; else if (k.startsWith('rt_')) { tmp.rtier = tmp.rtier || {}; tmp.rtier[k.slice(3)] = v } else tmp[k] = v });
    $('#fl').oninput = e => $('#flv').textContent = L(e.target.value);
    $('#obBack').onclick = () => { if (OB.edit) { OB.edit = false; OB.step = 0; $('#onb').hidden = true; $('#app').hidden = false; return } OB.step = 1; obRender() };
    $('#obNext').onclick = async () => { tmp.floor = +$('#fl').value; tmp.goal = $('#goal').value.trim(); ['ncr', 'mum', 'blr', 'oth'].forEach(k => tmp.cities[k] = tmp.cities[k] || 'ok'); tmp.cities.kc = tmp.cities.kc || 'meh'; tmp.rtier = tmp.rtier || {}; cats.forEach(c => { if (!tmp.rtier[c]) tmp.rtier[c] = (tmp.roles || []).includes(c) ? 'T1' : (tmp.avoid || []).includes(c) ? 'T3' : 'T2' }); tmp.roles = cats.filter(c => tmp.rtier[c] === 'T1'); tmp.avoid = cats.filter(c => tmp.rtier[c] === 'T3'); tmp.brand = tmp.brand || 2; tmp.six = tmp.six || 'heavy'; await saveProfile({ prefs: tmp }); MODEL = null; if (OB.edit) { OB.edit = false; OB.step = 0; $('#onb').hidden = true; $('#app').hidden = false; toast('Preferences saved'); location.hash = 'me'; renderAll(); return } OB.step = 3; obRender() };
    return
  }
  if (s === 3) {
    const pf = P.prefs; pf.pr = pf.pr || {};
    const list = CO.filter(c => c.seed !== false || true).filter(c => !['Process over'].includes(c.defSt));
    o.innerHTML = head(4, 'Rate the companies', 'How much do you want each one? This sets how much prep each company gets. Dream = P1.') + `<div class="panel mt">${list.map(c => `<div style="padding:10px 0;border-top:1px solid var(--line)"><b>${esc(c.name)}</b> <span class="muted">${esc(c.role)} · ${c.fixed ? L(c.fixed) + ' fixed' : ''}</span><div class="seg mt" data-rate="${c.id}" style="margin-top:6px">${[['P1', 'Dream'], ['P2', 'Want'], ['P3', 'Maybe'], ['Skip', 'Skip']].map(([v, l]) => `<button class="sm${(pf.pr[c.id] || '') === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>`).join('')}
    <div class="row2 mt"><button class="ghost" id="obBack">Back</button><span class="sp"></span><button class="pri" id="obNext">Next</button></div></div></div>`;
    o.querySelectorAll('[data-rate]').forEach(g => g.onclick = e => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); pf.pr[g.dataset.rate] = b.dataset.v });
    $('#obBack').onclick = () => { OB.step = 2; obRender() };
    $('#obNext').onclick = async () => { list.forEach(c => { if (!pf.pr[c.id]) pf.pr[c.id] = 'P2'; S.co[c.id] = Object.assign(S.co[c.id] || {}, { pr: pf.pr[c.id], in: pf.pr[c.id] === 'Skip' ? 0 : (LIVE_ST.includes(c.defSt || 'Awaiting shortlist') ? 1 : 0) }) }); save(); await saveProfile({ prefs: pf }); OB.step = 4; OB.cards = []; obRender() };
    return
  }
  if (s === 4) {
    if (!OB.cards) OB.cards = []; const n = OB.cards.filter(c => c.y != null).length;
    if (n >= 10) { finishOnb(); return }
    let card = OB.cards.find(c => c.y == null); if (!card) { card = hardCard(); OB.cards.push(card) }
    o.innerHTML = head(5, 'Ten hard calls', 'Only close calls, picked near your line. Picture yourself still unplaced, with the EOI form open. If you EOI and get selected, you are out of the season.') + `<div class="muted mt">${n + 1} of 10</div>
    <div class="card mt"><span class="chip">${esc(card.date)} · ${esc(card.phase)}</span><div class="co mt">${esc(card.company)}</div><div class="muted">${esc(card.role)}</div><ul class="tight">${card.desc.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
    <div class="row2 mt"><b style="font-size:30px;font-weight:300">${L(card.fixed)}</b><span class="muted">fixed · ${L(card.ctc)} CTC</span></div><div class="mt">📍 ${esc(card.city)}${card.six ? ' · <span class="chip warn">6-day week</span>' : ''}</div></div>
    <div class="ans2"><button id="cN">EONI</button><button class="pri" id="cY">EOI</button></div></div>`;
    const ans = async y => { card.y = y; P.eoi_rows = (P.eoi_rows || []).concat([[fx(card), y, 1, { co: card.company, fx: card.fixed, city: card.city, cat: card.cat, src: 'onboarding' }]]); MODEL = null; obRender() };
    $('#cY').onclick = () => ans(1); $('#cN').onclick = () => ans(0);
  }
}
function naiveParse(txt) {
  const lines = txt.split(/\n|•|●|▪/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 35 && s.length < 260);
  return { pointers: lines.slice(0, 40).map((t, i) => ({ id: 'p' + (i + 1), s: 'Resume', t, k: 'Story, numbers, terms', q: [] })), summary: '' }
}
function cvPreview() { const ps = CVP(); return `<p class="muted">${ps.length} pointers found.</p><ul class="tight">${ps.slice(0, 12).map(p => `<li><span class="muted">${esc(p.s)}:</span> ${esc(p.t)}</li>`).join('')}</ul>${ps.length > 12 ? `<p class="note">…and ${ps.length - 12} more on your CV board.</p>` : ''}` }
function hardCard() {
  const b = model(); const pick = a => a[Math.floor(Math.random() * a.length)];
  const used = new Set((OB.cards || []).map(c => c.company)); let best = null, bs = 9;
  const phases = [['25 Nov', 'dream window'], ['28 Nov', 'dream window'], ['2 Dec', 'dream window'], ['6 Dec', 'dream window ending'], ['15 Dec', 'main season over']];
  for (let t = 0; t < 500; t++) {
    const c = pick(SEED.LIB); if (used.has(c[0])) continue; const [cat, base] = pick(c[5]); const city = pick(c[6]); const ck_ = cityKey(city); if ((P.prefs.cities || {})[ck_] === 'never') continue;
    const fixed = Math.round((Math.max(14, base - 3) + Math.random() * 7) * 2) / 2; const six = Math.random() < .15; const ph = pick(phases);
    const card = { company: c[0], cat, fixed, city, six, tier: c[1], late: ph[1] === 'main season over', date: ph[0], phase: ph[1] };
    const p = sig(fx(card).reduce((s, v, k) => s + v * b[k], 0) + rolePref(cat)); const sc = Math.abs(p - .5) + (fixed >= 21.5 ? .5 : 0);
    if (sc < bs) { bs = sc; best = card }
  }
  const rt = SEED.RT[best.cat]; const lib = SEED.LIB.find(c => c[0] === best.company);
  return { ...best, role: rt[0][Math.floor(Math.random() * 3)], desc: rt[1].map(s => s.replace('{s}', lib[3])), ctc: +(best.fixed / lib[4]).toFixed(1) }
}
async function finishOnb() { $('#onb').innerHTML = '<div class="wrap" style="padding-top:30vh;text-align:center"><div class="muted">Calibrating to you…</div></div>'; await saveProfile({ eoi_rows: P.eoi_rows, onboarded: true }); MODEL = null; S.plan0 = todayIST(); await flush(); location.hash = 'today'; await loadAll() }

/* ---------- router ---------- */
const VIEWS = ['today', 'study', 'cv', 'practice', 'more', 'companies', 'season', 'me'];
const MORE = ['more', 'companies', 'season', 'me'];
let cur = 'today', curMod = 'story', curCo = null;
function route() {
  let h = (location.hash || '#today').slice(1).split('#')[0]; if (h.startsWith('co-')) { curCo = h.slice(3); h = 'companies' } else if (h === 'companies') curCo = null;
  if (h.startsWith('m-')) { curMod = h.slice(2); h = 'study' }
  if (!VIEWS.includes(h)) h = 'today'; cur = h;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + h)); document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === h || (a.dataset.v === 'more' && MORE.includes(h)))); renderAll()
}
function go(t) { const h = t.startsWith('study:') ? 'm-' + t.slice(6) : t.startsWith('co:') ? 'co-' + t.slice(3) : t; if (location.hash === '#' + h) route(); else location.hash = h; window.scrollTo(0, 0) }
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0) });
function renderMore() {
  const v = $('#v-more'); const live = liveCos().length, sl = slCos().length;
  const card = (h, t, d) => `<a class="panel" href="#${h}" style="display:block;text-decoration:none;color:inherit;margin-bottom:12px"><h3 style="margin:0">${t} <span style="color:var(--sky)">›</span></h3><p class="muted" style="margin:4px 0 0">${d}</p></a>`;
  v.innerHTML = `<h2>More</h2>` + card('companies', 'Companies', `${live} in your prep${sl ? `, ${sl} shortlisted` : ''}. Company pages, prep paths, shortlist button.`) + card('season', 'Season & EOI', 'EOI check, season charts and your decision log.') + card('me', 'Me', 'Resume, preferences and role tiers, build your CV prep with your own Claude, sign out.');
}
function renderAll() {
  if (!P || !P.onboarded) return;
  $('#hTitle').textContent = 'Placement prep, ' + (P.name || 'you');
  const sl = slCos(); $('#hsub').textContent = sl.length ? `Shortlist mode: ${sl.map(c => c.name).join(', ')} first.` : `${liveCos().length} live companies, no shortlist yet. General prep, weighted to your priorities.`;
  ({ today: renderToday, study: renderStudy, companies: renderCompanies, cv: renderCV, practice: renderPractice, season: renderSeason, me: renderMe, more: renderMore })[cur]()
}

/* ---------- Do next ---------- */
const MODBOOST = { ai: 1.9, story: 3.2, case: 2.3, guess: 2.3, ind: 2.0, digital: 1.5, tech: 1.5, mkt: 1.3, b2b: 1.1, sales: .9, saas: .9 };
function candidates(onlyCo) {
  const out = []; const live = onlyCo ? [onlyCo] : liveCos();
  // Company-specific prep (why us, deep dives, company cases) only for P1 companies and shortlists; the rest get general prep until they shortlist you
  const deep = onlyCo ? live : live.filter(c => coPr(c) === 'P1' || isSL(c));
  TOPICS.forEach(t => { if (tProg(t) >= 1) return; const rel = (t.co ? deep : live).filter(c => topicsFor(c).includes(t)); if (t.co && !rel.length) return; if (!rel.length && !['story'].includes(t.mod)) return; let sc = (MODBOOST[t.mod] || 1) * (1 + rel.reduce((a, c) => a + wt(c), 0)) * (1 - (t.i || 0) * .04) * (t.pri || 1); out.push({ id: t.id, l: t.t, sub: modById(t.mod).n, sc, go: 'study:' + t.mod + '#' + t.id, kind: 't' }) });
  CVP().forEach((p, i) => { if (cvProg(p) >= 1) return; const rel = live.filter(c => cvFor(c).includes(p.id)); const sc = 2.8 * (rel.reduce((a, c) => a + wt(c), 0) + (onlyCo ? 0 : .6)) * (1 - i * .004); if (onlyCo && !rel.length) return; out.push({ id: 'cv:' + p.id, l: p.t, sub: 'CV board', sc, go: 'cv', kind: 'cv' }) });
  deep.forEach(c => { if (ck('co:' + c.id + ':why')) return; out.push({ id: 'co:' + c.id + ':why', l: `Why ${c.name}, why this role`, sub: 'Company', sc: 2.6 * Math.max(.3, wt(c)) * 1.1, go: 'co:' + c.id, kind: 'co' }) });
  return out.sort((a, b) => b.sc - a.sc)
}
function doNext() {
  // A balanced top 10: story and CV first, then why-company, then cases/guesstimates, industry, then the rest
  const cap = { story: 3, cv: 3, co: 2, cg: 2, ind: 1, other: 2 }; const used = {}; const out = [];
  const grp = x => x.kind === 'cv' ? 'cv' : x.kind === 'co' ? 'co' : x.id.startsWith('t:story:') ? 'story' : (x.id.startsWith('t:case:') || x.id.startsWith('t:guess:')) ? 'cg' : x.id.startsWith('t:ind:') ? 'ind' : 'other';
  const order = ['story', 'cv', 'co', 'cg', 'ind', 'other']; const all = candidates();
  if (slCos().length) return all.slice(0, 10);
  order.forEach(g => all.filter(x => grp(x) === g).slice(0, cap[g]).forEach(x => out.push(x)));
  for (const x of all) { if (out.length >= 10) break; if (!out.includes(x)) out.push(x) }
  return out.slice(0, 10)
}
function nxRow(x) {
  if (x.kind === 't') return `<div class="chk"><input type="checkbox" id="n_${esc(x.id)}" data-ck="${esc(x.id)}" ${topicById(x.id) && subsFor(topicById(x.id)).length ? 'disabled title="Tick the cases inside"' : ''}><label for="n_${esc(x.id)}">${esc(x.l)} <span class="muted">· ${esc(x.sub)}</span></label><button class="go" data-go="${esc(x.go)}">Open</button></div>`;
  if (x.kind === 'cv') { const p = CVP().find(q => 'cv:' + q.id === x.id); return `<div class="chk"><span class="chip${cvProg(p) > 0 ? ' warn' : ''}">${Math.round(cvProg(p) * 3)}/3</span><label>${esc(x.l)} <span class="muted">· CV board</span></label><button class="go" data-go="cv#${esc(p.id)}">Open</button></div>` }
  return `<div class="chk"><input type="checkbox" id="n_${esc(x.id)}" data-ck="${esc(x.id)}"><label for="n_${esc(x.id)}">${esc(x.l)} <span class="muted">· ${esc(x.sub)}</span></label><button class="go" data-go="${esc(x.go)}">Open</button></div>`
}

/* ---------- daily plan (built from your priorities) ---------- */
function planDays() {
  const d0 = S.plan0 || todayIST(); const add = n => { const d = new Date(d0 + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) };
  const lab = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
  const all = candidates(); const pool = all.filter(x => true); const used = new Set();
  const take = (f, n) => { const r = []; for (const x of pool) { if (r.length >= n) break; if (used.has(x.id) || !f(x)) continue; used.add(x.id); r.push(x) } return r };
  const isMod = m => x => x.kind === 't' && x.id.startsWith('t:' + m + ':');
  const p1 = liveCos().filter(c => coPr(c) === 'P1').map(c => c.id);
  const day1 = [...take(isMod('story'), 4), ...take(x => x.kind === 'cv', 10), ...take(isMod('guess'), 2), ...take(isMod('case'), 2), ...take(x => x.kind === 'co' && p1.some(id => x.id.includes(':' + id + ':')), 3), ...take(isMod('ind'), 2), ...take(isMod('mkt'), 2)];
  const day2 = [...take(isMod('story'), 3), ...take(x => x.kind === 'cv', 12), ...take(isMod('case'), 4), ...take(isMod('guess'), 2), ...take(isMod('ind'), 4), ...take(x => x.kind === 'co', 5), ...take(isMod('digital'), 3), ...take(isMod('tech'), 2), ...take(isMod('mkt'), 3)];
  const rest = pool.filter(x => !used.has(x.id));
  return [{ d: d0, l: lab(d0), h: 'Heavy day 1: your story, your CV, P1 cases', it: day1, mock: 1 }, { d: add(1), l: lab(add(1)), h: 'Heavy day 2: finish the CV, cases, industry, role basics', it: day2, mock: 2 }, { d: 'later', l: 'After', h: 'Keep warm: everything left, in priority order, plus a daily mock', it: rest, mock: 1 }]
}

/* ---------- Today ---------- */
function renderToday() {
  const v = $('#v-today'); const live = liveCos().slice().sort((a, b) => wt(b) - wt(a)); const sl = slCos(); const a = allItems();
  let h = '';
  if (sl.length) {
    h += sl.map(c => { const r = itemsFor(c); const nx = candidates(c).slice(0, 15); return `<div class="banner mt"><div class="row2"><div><span class="chip p1">${esc(coSt(c))}</span><h2 style="margin:6px 0 2px">${esc(c.name)} is top priority</h2><div class="muted">${esc(c.role)} · ${pct(r)}% ready · process usually the next day</div></div><span class="sp"></span><button class="pri" data-mock="${c.id}">Mock me now</button><button data-go="co:${c.id}">Company page</button></div>
    <h3 class="mt">Your 6-hour shortlist block</h3><p class="note" style="margin:0">Work down this path in any order you like; then two mocks, then sleep.</p>${pathHtml(c)}
    <h3 class="mt">Do these first</h3>${nx.map(nxRow).join('') || '<p class="muted">Everything for this company is ticked. Do a mock.</p>'}</div>` }).join('');
  }
  h += `<div class="g2 mt"><div class="panel"><h2>Readiness by company</h2><div class="muted">Ranked by your priority × what the company is worth to you. Pink = P1. Tap Shortlist when one lands.</div><div class="board mt">` +
    live.map(c => { const r = itemsFor(c), p = pct(r), p1 = coPr(c) === 'P1'; const s = isSL(c); return `<div class="row"><div class="nm" data-co="${c.id}">${esc(c.name)}<small>${esc(c.role)}${s ? ' · <b style="color:var(--pink)">' + esc(coSt(c)) + '</b>' : ''}</small></div><div class="track"><div class="fill${p1 || s ? ' hot' : ''}" style="width:${p}%"></div></div><div class="pct">${p}%</div><button class="sl sm${s ? ' on' : ''}" data-sl="${c.id}">${s ? 'Shortlisted' : 'Shortlist'}</button></div>` }).join('') + `</div>
    <h3 class="mt2">By role type</h3>${roleBars()}</div>
    <div class="panel"><div class="row2" style="align-items:flex-end"><div class="big">${pct(a)}%</div><div class="muted" style="padding-bottom:8px">overall ready<br>${a.done.toFixed(1).replace(/\.0$/, '')} of ${a.total} items</div></div>
    <h3 class="mt">Do next</h3><div class="muted">${sl.length ? 'Shortlist first, then your general order.' : 'Your story and CV, then why-company, then cases and guesstimates, then industry, then frameworks, weighted by your priorities.'}</div><div class="mt">${doNext().map(nxRow).join('') || '<p class="muted">All done. Go do a mock.</p>'}</div></div></div>`;
  const days = planDays(); let sel = nt('_day', null); const td = todayIST(); if (!sel || !days.find(d => d.d === sel)) sel = (days.find(d => d.d === td) || (td > days[1].d ? days[2] : days[0])).d;
  const D = days.find(d => d.d === sel);
  h += `<div class="panel mt"><div class="row2"><h2 style="margin:0">Daily plan</h2><span class="sp"></span><div class="pills">${days.map(d => `<button class="sm${d.d === sel ? ' on' : ''}" data-day="${d.d}">${esc(d.l)} · ${d.it.length}</button>`).join('')}</div></div><div class="muted">${esc(D.h)}${D.d === td ? ' (today)' : ''}. A shortlist overrides this plan.</div>
  <div class="mt">${D.it.slice(0, 40).map(nxRow).join('') || '<p class="muted">Everything on this day is done.</p>'}<div class="chk"><span class="chip">AI</span><label>${D.mock} mock interview${D.mock > 1 ? 's' : ''} (CV grill + one case or guesstimate)</label><button class="go" data-go="practice">Open</button></div></div></div>`;
  v.innerHTML = h
}
function roleBars() {
  return ROLEGROUPS.map(g => { const ts = TOPICS.filter(t => g.mods.includes(t.mod) && (!t.co || liveCos().some(c => t.co.includes(c.id)))); const [d, n] = sumT(ts); const p = Math.round(d / Math.max(1, n) * 100); return `<div class="vbar mt" style="grid-template-columns:minmax(0,10em) minmax(0,1fr) 3em"><span style="font-size:14px">${esc(g.n)}</span><div class="track"><div class="fill ok" style="width:${p}%"></div></div><div class="pct">${p}%</div></div>` }).join('')
}

/* ---------- Study ---------- */
function renderStudy() {
  const v = $('#v-study'); const f = nt('_studyFor', 'all'); const fc = f !== 'all' ? coById(f) : null;
  const mods = MODS; const m = modById(curMod) || MODS[0];
  const users = liveCos().filter(c => c.mods.includes(m.id)).map(c => c.name);
  let h = `<div class="row2"><h2 style="margin:0">Study</h2><span class="sp"></span><label class="muted" for="studyFor">Show for</label><select id="studyFor"><option value="all">All companies</option>${liveCos().map(c => `<option value="${c.id}"${c.id === f ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
  <div class="pills mt">${mods.map(md => { const ts = TOPICS.filter(t => t.mod === md.id && (!fc || topicsFor(fc).includes(t))); const [d, n] = sumT(ts); const rel = !fc || fc.mods.includes(md.id); return `<button class="sm${md.id === m.id ? ' on' : ''}" data-mod="${md.id}" style="${rel ? '' : 'opacity:.45'}">${esc(md.n)} · ${d}/${n}</button>` }).join('')}</div>
  <div class="panel mt"><h2>${esc(m.n)}</h2><p class="muted" style="margin-top:0">${esc(m.d)}${users.length ? ' For: ' + esc(users.join(', ')) + '.' : ''}</p>`;
  const ts = TOPICS.filter(t => t.mod === m.id && (!fc || topicsFor(fc).includes(t)));
  h += ts.map(t => {
    const done = tProg(t); const subs = subsFor(t).map(bankById);
    const rel = liveCos().filter(c => topicsFor(c).includes(t)).map(c => c.name.split(' ')[0]);
    return `<details class="topic tp" id="${esc(t.id)}"${location.hash.includes(t.id) ? ' open' : ''}><summary><div class="chk" style="border:0;padding:0">${subs.length ? `<span class="chip${done >= 1 ? ' ok' : done > 0 ? ' warn' : ''}">${subs.filter(b => ck('b:' + b.id)).length}/${subs.length}</span>` : `<input type="checkbox" data-ck="${t.id}"${ck(t.id) ? ' checked' : ''} aria-label="Done">`}<span class="lbl" style="flex:1;cursor:pointer"><h3 style="display:inline">${esc(t.t)}</h3>${rel.length && rel.length < 8 ? ` <span class="muted">· ${esc(rel.join(', '))}</span>` : ''}</span><span class="chev" aria-hidden="true">▾</span></div></summary>
    <div class="body">${t.h}</div>${subs.length ? `<div class="mt">${subs.map(bankRow).join('')}</div>` : ''}${t.q ? `<div class="q"><b>Test yourself:</b> ${esc(t.q)} <button class="sm ghost" data-quiz="${t.id}" style="border:0;color:var(--sky)">Mock me on this</button></div>` : ''}
    ${t.hr ? hrBank() : ''}</details>` }).join('');
  h += '</div>'; v.innerHTML = h;
  $('#studyFor').onchange = e => { S.n._studyFor = e.target.value; save(); renderStudy() };
  const anc = (location.hash.split('#')[2]); if (anc) { const el = document.getElementById(anc); if (el) { el.open = true; setTimeout(() => el.scrollIntoView({ block: 'start' }), 50) } }
}
function bankRow(b) {
  const cos = (b.co || []).map(id => coById(id)).filter(Boolean).map(c => c.name.split(' ')[0]);
  return `<details class="hist" style="padding:8px 0"><summary style="color:var(--ink)"><span class="row2" style="display:inline-flex;gap:8px"><input type="checkbox" data-ck="b:${b.id}"${ck('b:' + b.id) ? ' checked' : ''} aria-label="Practised" onclick="event.stopPropagation()"><span class="chip">${esc(b.cat)}</span>${b.ind ? `<span class="chip">${esc(b.ind)}</span>` : ''}${b.src === 'cv' ? '<span class="chip warn">From your CV</span>' : b.src ? `<span class="chip">${esc(b.src)}</span>` : ''}${cos.length ? `<span class="chip">${esc(cos.join(', '))}</span>` : ''}</span><div style="margin:6px 0 0 28px">${esc(b.q)}</div></summary><div class="body" style="margin-left:28px">${b.how}${b.full ? `<details class="hist mt"><summary style="color:var(--acc,#7cc4ff)">Full walkthrough (interview style)</summary><div class="body">${b.full}</div></details>` : ''}</div></details>`
}
function hrBank() {
  const ans = (P.cv && P.cv.hr) || {};
  return `<div class="mt">${HRQ.map((q, i) => { const a = ans[q[0]]; return `<details class="hist"><summary style="color:var(--ink)">${esc(q[1])}</summary>${a ? `<div class="body" style="margin-top:6px">${a}</div>` : `<p class="note">${esc(q[2])}</p>`}<textarea data-n="hr_${q[0]}" placeholder="Your answer in your words: point, proof, link to the role.">${esc(nt('hr_' + q[0], ''))}</textarea></details>` }).join('')}</div>`
}

/* ---------- Companies ---------- */
function renderCompanies() {
  const v = $('#v-companies'); if (curCo && coById(curCo)) { v.innerHTML = coDetail(coById(curCo)); return }
  const live = CO.filter(inPrep), other = CO.filter(c => !inPrep(c));
  v.innerHTML = `<div class="row2"><h2 style="margin:0">Companies</h2><span class="sp"></span><button class="pri sm" data-eoi="1">EOI check</button></div><p class="muted">Tap one for its page. Shortlist sends it to the top of everything.</p><div class="g3 mt">` + live.map(c => { const r = itemsFor(c), p = pct(r); const s = isSL(c);
    return `<div class="panel cotile${s ? ' sl' : ''}" data-co="${c.id}"><div class="row2"><span class="chip${coPr(c) === 'P1' ? ' p1' : ''}">${esc(coPr(c))}</span><span class="sp"></span><span class="chip">${esc(coSt(c))}</span></div><h3 style="font-size:20px;margin-top:4px">${esc(c.name)}</h3><div class="muted">${esc(c.role)}</div><div class="row2">${c.ctc ? `<b style="font-weight:300;font-size:22px">${L(c.ctc)}</b>` : ''}${c.fixed ? `<span class="muted">fixed ${L(c.fixed)}</span>` : ''}</div><div class="track"><div class="fill${coPr(c) === 'P1' || s ? ' hot' : ''}" style="width:${p}%"></div></div><div class="row2"><span class="muted">${p}% ready · ${band(val(c))}</span><span class="sp"></span><button class="sl sm${s ? ' on' : ''}" data-sl="${c.id}">${s ? 'Shortlisted' : 'Shortlist'}</button></div></div>` }).join('') + `</div>` +
    (other.length ? `<h3 class="mt2">Not in your prep</h3><div class="pills mt">${other.map(c => `<button class="sm ghost" data-co="${c.id}">${esc(c.name)} · ${esc(coSt(c))}</button>`).join('')}</div>` : '')
}
function coDetail(c) {
  const r = itemsFor(c), p = pct(r); const s = isSL(c); const ind = TOPICS.filter(t => t.mod === 'ind' && t.co && t.co.includes(c.id));
  const kit = BANK.filter(b => bankOk(b) && (b.co || []).includes(c.id)); const gen = BANK.filter(b => bankOk(b) && !(b.co || []).length && c.mods.includes(b.kind === 'guess' ? 'guess' : 'case')).slice(0, 4);
  const cv = cvFor(c);
  return `<button class="ghost sm" data-go="companies">← All companies</button>
<div class="panel mt${s ? ' banner' : ''}"><div class="row2"><div><span class="chip${coPr(c) === 'P1' ? ' p1' : ''}">${esc(coPr(c))}</span><h2 style="font-size:32px;font-weight:300;margin:8px 0 2px">${esc(c.name)}</h2><div>${esc(c.role)}</div><div class="muted">${esc(c.team || '')}</div></div><span class="sp"></span>
<div class="row2"><button class="sl${s ? ' on' : ''}" data-sl="${c.id}">${s ? '✓ Shortlisted' : 'Shortlist'}</button><select data-st="${c.id}" aria-label="Status">${STATUS.map(x => `<option${x === coSt(c) ? ' selected' : ''}>${x}</option>`).join('')}</select><select data-pr="${c.id}" aria-label="Priority">${['P1', 'P2', 'P3', 'Skip'].map(x => `<option${x === coPr(c) ? ' selected' : ''}>${x}</option>`).join('')}</select></div></div>
<div class="kv mt">${c.ctc ? `<div><span>Total CTC</span><b>${L(c.ctc)}</b></div>` : ''}${c.fixed ? `<div><span>Fixed</span><b>${L(c.fixed)}</b></div>` : ''}<div><span>Worth to you</span><b>${L(val(c))}</b></div><div><span>Ready</span><b>${p}%</b></div></div>
<p class="note">${esc(c.pay || '')}${c.loc ? ' · ' + esc(c.loc) : ''}</p><div class="row2"><button class="pri" data-mock="${c.id}">Mock me for ${esc(c.name.split(' ')[0])}</button></div></div>
<div class="panel mt"><h3>Your prep path for ${esc(c.name)}</h3><p class="note" style="margin:0">The order you prepare in. Each step's progress counts towards this company's readiness.</p>${pathHtml(c)}</div>
<div class="g2 mt"><div class="panel"><h3>What the JD asks for</h3><ul class="tight">${(c.jd || []).map(x => `<li>${esc(x)}</li>`).join('') || '<li class="muted">No JD saved.</li>'}</ul>
${c.expect && c.expect.length ? `<h3 class="mt2">What to expect</h3><p class="note" style="margin:0">From the role type; confirm the real format with seniors.</p><ul class="tight">${c.expect.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
${ind.length ? `<h3 class="mt2">Industry & company brief</h3>${ind.map(t => `<div class="chk"><span class="chip${tProg(t) >= 1 ? ' ok' : ''}">${tProg(t) >= 1 ? 'Done' : 'To do'}</span><label>${esc(t.t)}</label><button class="go" data-go="study:ind#${esc(t.id)}">Open</button></div>`).join('')}` : ''}
<h3 class="mt2">Case & guesstimate kit for ${esc(c.name.split(' ')[0])}</h3>${(kit.length ? kit : gen).map(bankRow).join('') || '<p class="muted">Use the general case book in Study.</p>'}</div>
<div class="panel"><h3>Why ${esc(c.name)}, why this role</h3><div class="chk" style="border:0"><input type="checkbox" id="why_${c.id}" data-ck="co:${c.id}:why"${ck('co:' + c.id + ':why') ? ' checked' : ''}><label for="why_${c.id}">Written, with 3 CV proofs, and said out loud</label></div><textarea data-n="why_${c.id}" placeholder="Three lines: what draws you to the company, what you bring (CV proof), what you want to learn in this role.">${esc(nt('why_' + c.id, ''))}</textarea>
<h3 class="mt2">CV pointers they will probe</h3>${cv.map(id => { const q = CVP().find(x => x.id === id); const n = Math.round(cvProg(q) * 3); return `<div class="chk"><span class="chip${n === 3 ? ' ok' : ''}">${n}/3</span><label>${esc(q.t)}</label><button class="go" data-go="cv#${esc(id)}">Open</button></div>` }).join('') || '<p class="muted">Upload your resume in Me to map pointers.</p>'}
<h3 class="mt2">Study modules</h3><div class="pills">${c.mods.map(m => { const M = modById(m); if (!M) return ''; const ts = topicsFor(c).filter(t => t.mod === m); const d = ts.reduce((a, t) => a + tProg(t), 0); return `<button class="sm" data-go="study:${m}">${esc(M.n)} · ${Math.round(d)}/${ts.length}</button>` }).join('')}</div>
${c.ask && c.ask.length ? `<h3 class="mt2">Questions to ask them</h3><ul class="tight">${c.ask.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div></div>`
}

/* ---------- the per-company prep path, in the order you prepare ---------- */
function prepPath(c) {
  const T = k => topicById('t:' + k); const ind = TOPICS.filter(t => t.mod === 'ind' && t.co && t.co.includes(c.id));
  const brief = ind.filter(t => !/-(ai|vc|lead|gtm)$/.test(t.k)); const pick = suf => ind.filter(t => t.k.endsWith('-' + suf));
  const cv = cvFor(c);
  const steps = [
    { l: 'Your TMAY and story', ts: [T('story:tmay'), T('story:arc')].filter(Boolean), go: 'study:story' },
    { l: 'CV pointers they will probe', cv, go: 'cv' },
    { l: 'The company: business, goals, vision', ts: brief, go: 'study:ind', note: brief.length ? '' : 'Read its website, annual report and latest news; note segments, goals and vision.' },
    { l: 'AI at the company and in its industry', ts: pick('ai'), go: 'study:ind', note: pick('ai').length ? '' : 'Search the company + "AI"; note 2 uses and 1 risk.' },
    { l: 'General AI knowledge', ts: TOPICS.filter(t => t.mod === 'ai'), go: 'study:ai' },
    { l: 'Behavioural questions', ts: [T('story:hrbank'), T('story:sw'), T('story:mktcon')].filter(Boolean), go: 'study:story' },
    { l: 'Leadership, vision and campaigns', ts: pick('lead'), go: 'study:ind', note: pick('lead').length ? '' : 'Find one recent leadership interview and their best-known campaigns.' },
    { l: 'Industry value chain', ts: pick('vc'), go: 'study:ind', note: pick('vc').length ? '' : 'Draw the value chain from supplier to customer and where money is made.' },
    { l: 'Cases, GTM and guesstimates', ts: pick('gtm').concat(TOPICS.filter(t => (t.mod === 'case' || t.mod === 'guess') && t.co && t.co.includes(c.id))), go: 'study:ind' },
    { l: 'Why this company, why this role', why: 1, go: 'co:' + c.id }];
  return steps.map(s => { let d = 0, n = 0; if (s.ts) { const r = sumT(s.ts); d += r[0]; n += r[1] } if (s.cv) { s.cv.forEach(id => { const p = CVP().find(q => q.id === id); if (p) { d += cvProg(p); n += 1 } }) } if (s.why) { n = 1; d = ck('co:' + c.id + ':why') ? 1 : 0 } return { ...s, d, n } })
}
function pathHtml(c) {
  return `<div class="mt">${prepPath(c).map((s, i) => { const p = s.n ? Math.round(s.d / s.n * 100) : 0; const first = s.ts && s.ts.find(t => tProg(t) < 1); const g = first ? s.go + '#' + first.id : s.go;
    return `<div class="vbar mt" style="grid-template-columns:1.6em minmax(0,1fr) 5.5em auto"><b class="muted">${i + 1}</b><div><div style="font-size:15px">${esc(s.l)}</div>${s.n ? `<div class="track" style="height:8px;margin-top:4px"><div class="fill${p >= 100 ? ' ok' : ''}" style="width:${p}%"></div></div>` : `<div class="note">${esc(s.note || '')}</div>`}</div><div class="pct" style="font-size:13px">${s.n ? (Math.round(s.d * 10) / 10) + '/' + s.n : ''}</div><button class="go sm ghost" data-go="${esc(g)}">Open</button></div>` }).join('')}</div>`
}
function setStatus(id, st) { S.co[id] = Object.assign(S.co[id] || {}, { st, in: 1, t: Date.now() }); save(); renderAll(); if (st === 'Shortlisted') toast(coById(id).name + ' is now top priority') }

/* ---------- CV board ---------- */
function renderCV() {
  const v = $('#v-cv'); const f = nt('_cvFor', 'all'); const fc = f !== 'all' ? coById(f) : null; const list = fc ? CVP().filter(p => cvFor(fc).includes(p.id)) : CVP();
  const d = list.reduce((a, p) => a + cvProg(p), 0);
  if (!CVP().length) { v.innerHTML = `<div class="panel"><h2>CV board</h2><p class="muted">Upload your resume in Me to build your board.</p><button data-go="me">Go to Me</button></div>`; return }
  const secs = [...new Set(list.map(p => p.s))];
  v.innerHTML = `<div class="g2"><div><h2>CV board</h2><p class="muted" style="margin:0">Tick Story when you can tell it in STAR in 60–90 seconds, Numbers when you can defend every figure, Terms when you can explain every word one level deep.</p></div>
  <div class="panel"><div class="row2"><label class="muted" for="cvFor">For</label><select id="cvFor"><option value="all">All companies</option>${liveCos().map(c => `<option value="${c.id}"${c.id === f ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select><span class="sp"></span><b>${Math.round(d / Math.max(1, list.length) * 100)}% ready</b></div></div></div>` +
    secs.map(s => `<div class="panel mt"><h3>${esc(s)}</h3>` + list.filter(p => p.s === s).map(cvRow).join('') + '</div>').join('');
  $('#cvFor').onchange = e => { S.n._cvFor = e.target.value; save(); renderCV() };
  const anc = location.hash.split('#')[2]; if (anc) { const el = document.getElementById('p_' + anc); if (el) { el.querySelector('details') && (el.querySelector('details').open = true); setTimeout(() => el.scrollIntoView({ block: 'start' }), 50) } }
}
function cvRow(p) {
  const tags = liveCos().filter(c => cvFor(c).includes(p.id)).map(c => c.name.split(' ')[0]);
  const star = p.star ? `<div class="star">${p.defend ? `<p><b>If they read it back to you:</b> ${p.defend}</p>` : ''}${p.star.map(([k, t]) => `<p><b>${esc(k)}</b> ${t}</p>`).join('')}</div>` : '';
  const extra = [p.nums ? `<h4>Numbers to defend</h4><p>${p.nums}</p>` : '', p.terms ? `<h4>Terms</h4><p>${p.terms}</p>` : '', p.q && p.q.length ? `<h4>Likely questions</h4><ul class="tight">${p.q.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '', p.angles ? `<h4>Company angles</h4><p>${p.angles}</p>` : ''].join('');
  return `<div class="cvp" id="p_${esc(p.id)}"><div><div class="tx">${esc(p.t)}</div><div class="k">${p.ready ? '<span class="chip ok">Prepared in your CV chat</span> ' : ''}Be ready on: ${esc(p.k || '')}${tags.length ? ' · Probed by ' + esc(tags.join(', ')) : ''}</div></div>
  <div class="bx">${[['s', 'Story'], ['n', 'Numbers'], ['k', 'Terms']].map(([x, l]) => `<label><input type="checkbox" data-ck="cv:${p.id}:${x}"${ck('cv:' + p.id + ':' + x) ? ' checked' : ''}>${l}</label>`).join('')}</div>
  <details${location.hash.includes(p.id) ? ' open' : ''}><summary>${p.star ? 'STAR answer, numbers, questions' : 'Questions and your notes'}</summary>${star}${extra}<h4>Your notes</h4><textarea data-n="cvn_${p.id}" placeholder="Backstory: situation, what you did, how the number was calculated, likely follow-ups">${esc(nt('cvn_' + p.id, ''))}</textarea></details></div>`
}

/* ---------- Mock interview ---------- */
const TYPES = ['CV grill', 'Behavioural / HR', 'Guesstimate', 'Case', 'Role knowledge', 'Why this company'];
let curQ = null, busy = false, dict = null;
function renderPractice() {
  const v = $('#v-practice');
  if (!v.dataset.built) {
    v.dataset.built = 1;
    v.innerHTML = `<div class="g2"><div class="panel"><h2>Mock interviewer</h2><p class="muted" style="margin-top:0">Claude asks one question for the company and type you pick, then scores your answer and asks the follow-up a panel would.</p><p class="note" style="border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-top:8px"><b>Paid AI.</b> Each question and each scoring costs real money, so there's a limit of 20 AI uses a day per person (about 10 scored answers). Write your answer properly before you tap score. To practise for free, use the question bank in Study, or open a case and speak your answer out loud.</p>
    <div class="row2 mt"><select id="pCo"></select><select id="pType">${TYPES.map(t => `<option>${t}</option>`).join('')}</select><button class="pri" id="pAsk">Ask me</button></div>
    <div id="pQ" class="mt"></div><div id="pAnsWrap" class="mt" hidden><textarea id="pAns" placeholder="Answer as you would in the room. Rough is fine."></textarea>
    <div class="row2 mt"><button id="pMic" hidden>🎙 Speak it</button><button class="pri" id="pEval">Score my answer</button><span class="sp"></span><span class="note" id="pStat"></span></div></div><div id="pFb" class="mt"></div></div>
    <div class="panel"><h2>Recent practice</h2><div id="pHist"></div></div></div>`;
    $('#pAsk').onclick = () => askQ(); $('#pEval').onclick = evalA; setupMic()
  }
  const keep = $('#pCo').value; $('#pCo').innerHTML = `<option value="general">General</option>` + liveCos().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(''); if (keep) $('#pCo').value = keep;
  $('#pHist').innerHTML = S.h.length ? S.h.slice(0, 15).map(h => `<div class="hist"><div class="row2"><span class="chip">${esc(h.co)}</span><span class="chip">${esc(h.type)}</span>${h.score ? `<span class="chip p1">${esc(h.score)}</span>` : ''}<span class="sp"></span><span class="note">${esc(h.t)}</span></div><div style="margin-top:6px">${esc(h.q)}</div><details><summary>Your answer and feedback</summary><p class="muted">${esc(h.a)}</p><div class="fb">${fmt(h.f)}</div></details></div>`).join('') : '<p class="muted">Nothing yet. Your last 30 attempts are kept here.</p>'
}
function fmt(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }
function ctxFor(id) { const c = coById(id); return c ? { name: c.name, role: c.role, team: c.team || '', jd: (c.jd || []).join('; '), expect: (c.expect || []).join('; ') } : null }
function cvText() { return (P.name || '') + '. ' + CVP().map(p => p.s + ': ' + p.t).join(' | ') }
function fallbackQ(co, type) {
  const c = coById(co); if (type === 'CV grill' && CVP().length) { const ids = c ? cvFor(c) : CVP().map(p => p.id); const p = CVP().find(x => x.id === ids[Math.floor(Math.random() * ids.length)]) || CVP()[0]; return { question: `Walk me through this line on your CV: "${p.t}". How did you get the number, and what exactly did you do?`, looking_for: ['Your own role, clearly', 'How the number was measured', 'What you would do differently'] } }
  const pool = BANK.filter(b => bankOk(b) && (type === 'Guesstimate' ? b.kind === 'guess' : type === 'Case' ? b.kind === 'case' : true) && (!c || !(b.co || []).length || b.co.includes(c.id)));
  const b = pool[Math.floor(Math.random() * pool.length)]; return { question: b ? b.q : 'Tell me about yourself.', looking_for: [] }
}
async function askQ(fixed) {
  if (busy) return; busy = true; const co = $('#pCo').value, type = $('#pType').value; $('#pFb').innerHTML = ''; $('#pAns').value = ''; $('#pQ').innerHTML = '<p class="muted">Thinking of a question…</p>';
  let q = fixed || null;
  if (!q) { try { const r = await ai('question', { company: ctxFor(co), type, cv: cvText(), recent: S.h.slice(0, 6).map(h => h.q) }); q = r } catch (e) { q = fallbackQ(co, type); $('#pStat').textContent = e.code === 'no_key' ? 'AI is not switched on yet, so this question is from your bank.' : e.code === 'cap' ? 'Daily AI limit reached; this question is from your bank.' : 'AI unavailable; question from your bank.' } }
  curQ = { q: q.question, lf: q.looking_for || [], co: co === 'general' ? 'General' : coById(co).name, type, coId: co };
  $('#pQ').innerHTML = `<div class="qcard">${esc(curQ.q)}</div>`; $('#pAnsWrap').hidden = false; busy = false
}
async function evalA() {
  if (!curQ || busy) return; const a = $('#pAns').value.trim(); if (a.length < 15) { $('#pStat').textContent = 'Write or speak a bit more first.'; return }
  busy = true; $('#pEval').disabled = true; $('#pStat').textContent = 'Scoring…';
  let txt = ''; try { const r = await ai('evaluate', { company: ctxFor(curQ.coId), type: curQ.type, question: curQ.q, looking_for: curQ.lf, answer: a.slice(0, 4000), cv: cvText() }); txt = r.text } catch (e) { $('#pStat').textContent = e.code === 'no_key' ? 'Scoring needs the AI key (see Me). Say it aloud and compare with your notes for now.' : e.code === 'cap' ? 'Daily AI limit reached. Try again tomorrow.' : 'Could not score right now. Try again in a minute.'; busy = false; $('#pEval').disabled = false; return }
  $('#pFb').innerHTML = `<div class="panel fb" style="background:var(--p2)">${fmt(txt)}</div><div class="row2 mt"><button id="pFollow">Answer the follow-up</button><button class="ghost" id="pNew">New question</button></div>`;
  const sc = (txt.match(/(\d+(?:\.\d)?)\s*\/\s*10/) || [])[1];
  S.h.unshift({ t: new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), co: curQ.co, type: curQ.type, q: curQ.q.slice(0, 400), a: a.slice(0, 700), f: txt.slice(0, 1600), score: sc ? sc + '/10' : '' }); S.h = S.h.slice(0, 30); save();
  $('#pStat').textContent = 'Saved to recent practice.'; busy = false; $('#pEval').disabled = false; renderPractice();
  const fu = (txt.match(/Follow-up they would ask:\**\s*(.+)/i) || [])[1];
  $('#pFollow').onclick = () => { if (!fu) return askQ(); curQ = { ...curQ, q: fu.trim(), lf: [] }; $('#pQ').innerHTML = `<div class="qcard">${esc(curQ.q)}</div>`; $('#pAns').value = ''; $('#pFb').innerHTML = ''; $('#pAns').focus() };
  $('#pNew').onclick = () => askQ()
}
function setupMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return; const btn = $('#pMic'); btn.hidden = false; let on = false, base = '';
  btn.onclick = () => { if (on) { dict && dict.stop(); return } dict = new SR(); dict.lang = 'en-IN'; dict.interimResults = true; dict.continuous = true; base = $('#pAns').value;
    dict.onresult = e => { let fin = '', tmp = ''; for (let i = 0; i < e.results.length; i++) { (e.results[i].isFinal ? (fin += e.results[i][0].transcript + ' ') : (tmp += e.results[i][0].transcript)) } $('#pAns').value = (base ? base + ' ' : '') + fin + tmp };
    dict.onend = () => { on = false; btn.textContent = '🎙 Speak it'; btn.classList.remove('on') }; dict.onerror = () => { on = false };
    try { dict.start(); on = true; btn.textContent = '■ Stop'; btn.classList.add('on') } catch (e) { } }
}

/* ---------- Season & EOI ---------- */
function renderSeason() {
  const v = $('#v-season'); const vs = liveCos().map(c => ({ c, v: val(c) })).sort((a, b) => b.v - a.v); const mx = Math.max(30, ...vs.map(x => x.v));
  const ph = phaseNow(); const tc = stillToCome();
  v.innerHTML = `<div class="panel banner"><div class="row2"><div><h2 style="margin:0">EOI or EONI?</h2><div class="muted">New company on Skynet? Enter its details and the JD for a verdict from your own model.</div></div><span class="sp"></span><button class="pri" data-eoi="1" style="min-width:120px">EOI check</button></div></div>
  <div class="kv panel mt">${[['Batch (PGP 32)', '227'], ['PPOs', '67 · 30%'], ['PPO average', '₹25.3L'], ['Forecast final avg', '~₹21.5L'], ['Last year final', '₹20.0L'], ['Now', ph[0]]].map(x => `<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div>
  <div class="g2 mt"><div class="panel"><h3>How the season is moving</h3><div class="legend"><span><i style="background:#7ee0b0"></i>PGP 30</span><span><i style="background:#ffd27a"></i>PGP 31</span><span><i style="background:#ff5c8a"></i>PGP 32 so far</span><span><i style="background:#8fd3ff"></i>Base-case forecast</span></div>${chartCurve()}<p class="note">Share of the batch placed, from 1 Oct. The forecast runs your Forecast Playground's base case.</p></div>
  <div class="panel"><h3>The earlier, the richer</h3>${chartPay()}<p class="note">Average CTC of offers by week after 18 Nov, from the last two seasons. ${esc(ph[1])}</p></div></div>
  <div class="g2 mt"><div class="panel"><h3>What each live company is worth to you</h3><div class="muted">Gurgaon-equivalent fixed pay by your own EOI rules. Yellow line = ₹18L.</div>${vs.map(({ c, v }) => `<div class="vbar mt"><b style="font-size:14px">${esc(c.name)}</b><div class="track" style="height:14px"><div class="fill${v >= 20 ? ' hot' : ''}" style="width:${Math.max(3, v / mx * 100)}%"></div><div class="mark" style="left:${18 / mx * 100}%"></div></div><div class="pct">${L(v)}</div></div>`).join('')}</div>
  <div class="panel"><h3>Still likely to come</h3><p class="muted" style="margin-top:0">From the return model: recruiters from last year that haven't appeared yet.</p>${tc.map(c => `<div class="chk"><span class="chip">${Math.round(c[2] * 100)}%</span><label>${esc(c[0])} <span class="muted">· last year ${L(c[1])} CTC${c[3] ? ' · EOI ' + esc(c[3]) : ''}</span></label></div>`).join('')}
  <h3 class="mt2">Your EOI decisions</h3><div id="dlog"><p class="muted">Loading…</p></div>
  <h3 class="mt2">Your other tools</h3><ul class="tight"><li><a href="https://claude.ai/artifact/MAUWybfzjosqAUpoFtFBvf" target="_blank" rel="noopener">PGP 32 Forecast Playground</a> <span class="muted">the full season model</span></li></ul></div></div>`;
  sb.from('pp_decisions').select('company,decision,verdict,created_at').order('created_at', { ascending: false }).limit(20).then(({ data }) => { const el = $('#dlog'); if (!el) return; el.innerHTML = (data || []).length ? data.map(d => `<div class="chk"><span class="chip${d.decision === 'EOI' ? ' ok' : ''}">${esc(d.decision)}</span><label>${esc(d.company)} <span class="muted">· model said ${esc(d.verdict && d.verdict.label)} ${d.verdict ? d.verdict.conf + '%' : ''}</span></label><span class="note">${new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></div>`).join('') : '<p class="muted">None yet. Every real decision you log here trains your model.</p>' })
}
function svgFrame(w, h) { return [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" style="display:block">`, '</svg>'] }
function project() { const N = 227, P0 = 77, T0 = 48; let U = N - P0, cum = P0; const out = [];
  for (let t = 0; t < 120; t++) { const i = Math.min(SEED.haz31.length - 1, t + 3); const hb = .7 * SEED.haz31[i] + .3 * SEED.haz30[i]; const h = 1 - Math.pow(1 - Math.min(hb, 1), 1.1); const e = U * h; U -= e; cum += e; out.push([T0 + t, cum / N * 100]) } return out }
function chartCurve() {
  const W = 560, H = 230, m = { l: 34, r: 8, t: 8, b: 24 }, X = 160; const x = i => m.l + i / X * (W - m.l - m.r), y = v => m.t + (1 - v / 100) * (H - m.t - m.b);
  const [o, c] = svgFrame(W, H); let s = o;
  [0, 25, 50, 75, 100].forEach(v => { s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(143,211,255,.14)"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#8fb0cc">${v}%</text>` });
  [['Oct', 0], ['Nov', 31], ['Dec', 61], ['Jan', 92], ['Feb', 123]].forEach(([l, d]) => s += `<text x="${x(d) + 3}" y="${H - 6}" font-size="11" fill="#8fb0cc">${l}</text>`);
  const line = (arr, col, dash) => `<path d="${arr.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join('')}" fill="none" stroke="${col}" stroke-width="2" ${dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  s += line(SEED.cur30.slice(0, X + 1).map((v, i) => [i, v]), '#7ee0b0') + line(SEED.cur31.slice(0, X + 1).map((v, i) => [i, v]), '#ffd27a');
  s += line(project().filter(p => p[0] <= X), '#8fd3ff', 1);
  const act = [[27, 67], [28, 71], [29, 72], [33, 77], [48, 77]].map(p => [p[0], p[1] / 227 * 100]); s += line(act, '#ff5c8a') + act.map(p => `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="3.5" fill="#ff5c8a"/>`).join('');
  const t = Math.round((Date.now() - Date.UTC(2026, 9, 1)) / 864e5); if (t > 0 && t < X) s += `<line x1="${x(t)}" x2="${x(t)}" y1="${m.t}" y2="${H - m.b}" stroke="#c4dcf0" stroke-dasharray="2 3"/><text x="${x(t) + 4}" y="${m.t + 11}" font-size="11" fill="#c4dcf0">today</text>`;
  return s + c
}
function chartPay() {
  const W = 420, H = 200, m = { l: 34, r: 8, t: 10, b: 24 }; const C = SEED.ctc; const f = wk => Math.exp(C.a + C.b1 * Math.min(wk, 4) + C.b2 * Math.max(wk - 4, 0)) / 1e5 * 1.04 * Math.exp(C.sd * C.sd / 2);
  const pts = []; for (let w = 0; w <= 10; w += .25) pts.push([w, f(w)]); const ymax = 32, ymin = 10; const x = w => m.l + w / 10 * (W - m.l - m.r), y = v => m.t + (1 - (v - ymin) / (ymax - ymin)) * (H - m.t - m.b);
  const [o, c] = svgFrame(W, H); let s = o;
  [10, 15, 20, 25, 30].forEach(v => s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(143,211,255,.14)"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#8fb0cc">₹${v}L</text>`);
  [0, 2, 4, 6, 8, 10].forEach(w => s += `<text x="${x(w)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#8fb0cc">wk ${w}</text>`);
  s += `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join('')}" fill="none" stroke="#ff5c8a" stroke-width="2.5"/>`;
  const wk = Math.max(0, (Date.now() - Date.UTC(2026, 10, 18)) / 6048e5); if (wk <= 10) s += `<circle cx="${x(wk)}" cy="${y(f(wk))}" r="5" fill="#fff"/><text x="${x(wk) + 8}" y="${y(f(wk)) - 6}" font-size="12" fill="#fff">now ~${L(f(wk))}</text>`;
  return s + c
}

/* ---------- EOI check modal ---------- */
function eoiForm() {
  const cats = Object.keys(CATLAB);
  openModal(`<div class="row2"><h2 style="margin:0">EOI check</h2><span class="sp"></span><button class="ghost sm" data-close="1">Close</button></div>
  <label class="f" for="e_co">Company</label><input id="e_co" type="text" list="e_list" autocomplete="off"><datalist id="e_list">${SEED.LIB.map(c => `<option value="${esc(c[0])}">`).join('')}</datalist>
  <label class="f" for="e_role">Role name</label><input id="e_role" type="text">
  <label class="f" for="e_city">Location</label><input id="e_city" type="text" list="e_cities" placeholder="e.g. Gurgaon, Mumbai, PAN India"><datalist id="e_cities">${['Gurgaon', 'Delhi NCR', 'Noida', 'Mumbai', 'Bangalore', 'Pune', 'Hyderabad', 'PAN India', 'Kolkata', 'Chennai', 'Ahmedabad'].map(c => `<option value="${c}">`).join('')}</datalist>
  <div class="row2"><div style="flex:1"><label class="f" for="e_fx">Fixed pay (₹ L)</label><input id="e_fx" type="number" inputmode="decimal" step=".1"></div><div style="flex:1"><label class="f" for="e_ctc">Total CTC (₹ L)</label><input id="e_ctc" type="number" inputmode="decimal" step=".1"></div></div>
  <label class="f" for="e_jd">JD (PDF or Word .docx)</label><input id="e_jd" type="file" accept=".pdf,.docx"><p class="note" id="e_jdm">Read on your phone; nothing is uploaded.</p>
  <details><summary>Paste JD text instead</summary><textarea id="e_jdt"></textarea></details>
  <div class="row2 mt"><label class="row2" style="gap:6px"><input type="checkbox" id="e_six" style="width:20px;height:20px;accent-color:var(--pink)"> 6-day week</label><label class="row2" style="gap:6px"><input type="checkbox" id="e_bond" style="width:20px;height:20px;accent-color:var(--pink)"> Service bond</label></div>
  <details class="mt"><summary>Adjust what the app guessed</summary><label class="f" for="e_cat">Role type</label><select id="e_cat">${cats.map(c => `<option value="${c}">${esc(CATLAB[c])}</option>`).join('')}</select><label class="f" for="e_tier">Brand tier</label><select id="e_tier"><option value="auto">Auto</option><option value="super">Super brand</option><option value="top">Big name</option><option value="good">Known</option><option value="unknown">Lesser-known</option></select></details>
  <button class="pri mt" id="e_go" style="width:100%;min-height:52px">Get verdict</button><div id="e_out"></div>`);
  let jdText = ''; let catTouched = false;
  $('#e_cat').onchange = () => catTouched = true;
  const guess = () => { if (!catTouched) $('#e_cat').value = detectCat($('#e_role').value, jdText || $('#e_jdt').value) };
  $('#e_role').oninput = guess;
  $('#e_jd').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#e_jdm').textContent = 'Reading the JD…'; try { jdText = await readFile(f); $('#e_jdm').textContent = `Read ${jdText.split(/\s+/).length} words from ${f.name}.`; guess() } catch (er) { $('#e_jdm').textContent = er.message || 'Could not read that file.' } };
  $('#e_go').onclick = () => {
    const inp = { company: $('#e_co').value.trim(), role: $('#e_role').value.trim(), city: $('#e_city').value.trim() || 'PAN India', fixed: +$('#e_fx').value, ctc: +$('#e_ctc').value || +$('#e_fx').value, jd: jdText || $('#e_jdt').value, six: $('#e_six').checked, bond: $('#e_bond').checked, cat: $('#e_cat').value, late: todayIST() > '2026-12-12' };
    if (!inp.company || !inp.fixed) { $('#e_out').innerHTML = '<p class="note" style="color:var(--pink)">Company and fixed pay are needed.</p>'; return }
    const t = $('#e_tier').value; inp.tier = t === 'auto' ? tierOf(inp.company) : t;
    const r = verdict(inp); showVerdict(inp, r)
  }
}
function showVerdict(inp, r) {
  const cls = r.close ? 'mid' : r.yes ? 'yes' : 'no'; const lab = r.close ? (r.yes ? 'Lean EOI' : 'Lean EONI') : r.yes ? 'EOI' : 'EONI';
  r.label = lab;
  $('#e_out').innerHTML = `<div class="verdict ${cls} mt"><div class="row2"><div class="vd">${lab}</div><span class="sp"></span><div style="text-align:right"><b style="font-size:26px;font-weight:300">${r.conf}%</b><div class="note">confidence</div></div></div>
  <p style="margin:10px 0 0">${esc(r.insight)}</p>
  <h4>Why</h4><ul class="tight">${r.reasons.map(([s, t]) => `<li><b style="color:${s === '+' ? 'var(--ok)' : 'var(--pink)'}">${s}</b> ${esc(t)}</li>`).join('') || '<li>Nothing stands out either way.</li>'}</ul>
  ${r.jf.fit != null ? `<h4>JD fit: ${r.jf.fit}%</h4><p class="note" style="margin:0">Asks for: ${esc(r.jf.asked.join(', '))}.</p>${r.jf.ptr.length ? `<p class="note">Lead with: ${r.jf.ptr.map(p => esc(p.t.length > 80 ? p.t.slice(0, 80).replace(/\s+\S*$/, '') + '…' : p.t)).join(' · ')}</p>` : ''}` : ''}
  <h4>Season</h4><p class="note" style="margin:0">Now: ${esc(r.ph[0])}. ${esc(r.ph[1])}${r.tc.length ? ' Still likely to come: ' + r.tc.slice(0, 4).map(c => esc(c[0]) + ' (' + L(c[1]) + ')').join(', ') + '.' : ''}</p></div>
  <p class="note mt">What did you do? Logging it trains your model.</p><div class="ans2"><button id="e_n">I EONI'd</button><button class="pri" id="e_y">I EOI'd · add to prep</button></div>`;
  $('#e_y').onclick = () => logDecision(inp, r, 'EOI'); $('#e_n').onclick = () => logDecision(inp, r, 'EONI');
  $('#e_out').scrollIntoView({ block: 'start', behavior: 'smooth' })
}
async function logDecision(inp, r, dec) {
  const y = dec === 'EOI' ? 1 : 0; const v = { label: r.label, conf: r.conf, p: +r.p.toFixed(3) };
  await sb.from('pp_decisions').insert({ user_id: USER.id, company: inp.company, inputs: { ...inp, jd: (inp.jd || '').slice(0, 3000) }, verdict: v, decision: dec });
  P.eoi_rows = (P.eoi_rows || []).concat([[r.x, y, 1, { co: inp.company, fx: inp.fixed, city: inp.city, cat: inp.cat, src: 'real' }]]); await saveProfile({ eoi_rows: P.eoi_rows }); MODEL = null;
  const id = slug(inp.company + '-' + inp.role); let c = coById(id);
  if (!c) {
    const sents = String(inp.jd || '').split(/\n|•|●|(?<=\.)\s+/).map(s => s.replace(/\s+/g, ' ').trim()).filter(s => s.length > 40 && s.length < 240);
    const jd = sents.filter(s => /^(own|drive|lead|manage|plan|work|build|develop|define|analy|create|support|execute|deliver|partner|run|track|identify|coordinate|design|implement|conduct|prepare)/i.test(s)).slice(0, 7);
    c = { id, name: inp.company, role: inp.role || 'Role', team: '', ctc: inp.ctc, fixed: inp.fixed, pay: `Fixed ${inp.fixed} · CTC ${inp.ctc}`, loc: inp.city, city: inp.city, tier: inp.tier, rt: inp.cat, mods: CAT2MODS[inp.cat] || ['story', 'mkt'], jd: jd.length ? jd : sents.slice(0, 6), expect: [], ask: [], kw: jdFit(inp.jd).asked.map(s => s.toLowerCase().split(/[ /]/)[0]), order: 50, added: todayIST() };
    await sb.from('pp_companies').insert({ id, data: c, created_by: USER.id }); CO.push({ ...c })
  }
  S.co[id] = Object.assign(S.co[id] || {}, dec === 'EOI' ? { st: 'Awaiting shortlist', in: 1, pr: (S.co[id] || {}).pr || 'P2' } : { st: 'Not pursuing', in: 0 }); save();
  closeModal(); toast(dec === 'EOI' ? `${inp.company} added to your prep` : 'Logged. Your model just learned from it'); renderAll()
}

/* ---------- Me ---------- */
function renderMe() {
  const v = $('#v-me'); const pf = P.prefs || {};
  v.innerHTML = `<div class="g2"><div class="panel"><h2>${esc(P.name || 'You')}</h2><p class="muted">${esc(USER.email)}</p>
  <h3 class="mt">Your resume</h3><p class="muted" style="margin-top:0">${CVP().length} pointers on your CV board. One resume per account; replacing it rebuilds your board (your ticks on old pointers are kept by pointer id).</p><input id="meCV" type="file" accept=".pdf,.docx"><p class="note" id="meCVm"></p>
  ${pf.floor ? `<h3 class="mt2">Your EOI rules</h3><p class="muted" style="margin-top:0">Floor ${L(pf.floor)} fixed · brand weight ${pf.brand}/4 · 6-day week: ${esc(pf.six)}${pf.goal ? ' · Goal: ' + esc(pf.goal) : ''}</p>` : ''}
  <p class="muted">Your model has learned from ${(P.eoi_rows || []).length} answers.</p>
  <div class="row2"><button id="meEdit" class="sm">Change preferences and role tiers</button></div>
  <div class="row2 mt"><button id="meOut" class="ghost">Sign out</button></div></div>
  <div class="panel"><h3>Build your CV prep with your own Claude</h3><p class="muted" style="margin-top:0">Free with your own Claude account. Copy this prompt into a new Claude chat, attach your resume (and paste any CV critique notes), then paste Claude's reply below. It fills your CV board (STAR stories, likely questions, how to defend each number), your HR answers, and cases and guesstimates built from your CV.</p>
  <div class="row2"><button id="cpP">Copy prompt</button><span class="note" id="cpM"></span></div>
  <textarea id="impT" rows="5" placeholder="Paste Claude's reply here (it starts with {)" style="width:100%;margin-top:8px"></textarea><div class="row2 mt"><button class="pri" id="impGo">Import</button><span class="note" id="impM"></span></div></div>
  <div class="panel"><h3>Install on your phone</h3><ul class="tight"><li><b>iPhone:</b> open this site in Safari → Share → Add to Home Screen.</li><li><b>Android:</b> open in Chrome → ⋮ → Install app (or Add to Home screen).</li></ul>
  <h3 class="mt2">AI use today</h3><p class="muted" id="meAI">…</p><p class="note">AI is used only for mock-interview questions and scoring, and for reading a resume. The EOI verdict runs on your phone for free.</p></div></div>`;
  $('#meOut').onclick = async () => { await flush(); await sb.auth.signOut() };
  $('#meEdit').onclick = () => { OB.step = 2; OB.edit = true; showOnboarding() };
  $('#cpP').onclick = async () => { const t = importPrompt(); try { await navigator.clipboard.writeText(t); $('#cpM').textContent = 'Copied. Paste it into a new Claude chat.' } catch (e) { $('#impT').value = t; $('#impT').select(); $('#cpM').textContent = 'Copy the text in the box below, then clear it.' } };
  $('#impGo').onclick = async () => { const r = parseImport($('#impT').value); if (r.err) { $('#impM').textContent = r.err; return } const cv = { ...(P.cv || {}), ...r.cv }; await saveProfile({ cv }); $('#impM').textContent = `Imported: ${(cv.pointers || []).length} pointers, ${Object.keys(cv.hr || {}).length} HR answers, ${(cv.bank || []).length} cases and guesstimates.`; renderAll(); toast(`Imported ${(cv.pointers || []).length} pointers, ${Object.keys(cv.hr || {}).length} HR answers, ${(cv.bank || []).length} cases and guesstimates.`) };
  $('#meCV').onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#meCVm').textContent = 'Reading…'; try { const txt = await readFile(f); $('#meCVm').textContent = 'Rebuilding your board…'; let cv; try { cv = (await ai('parse_resume', { text: txt.slice(0, 14000) })).cv } catch (er) { cv = naiveParse(txt) } if (P.cv && P.cv.hr) cv.hr = P.cv.hr; await saveProfile({ resume_text: txt.slice(0, 20000), cv }); $('#meCVm').textContent = 'Done.'; renderAll() } catch (er) { $('#meCVm').textContent = er.message } };
  sb.from('pp_ai_usage').select('n').eq('day', todayIST()).maybeSingle().then(({ data }) => { const el = $('#meAI'); if (el) el.textContent = `${data ? data.n : 0} of 20 AI calls used today (each mock question and each scoring uses one).` })
}

/* ---------- events ---------- */
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ck != null) return setCk(t.dataset.ck, t.checked);
  if (t.dataset.st) { setStatus(t.dataset.st, t.value); return }
  if (t.dataset.pr) { S.co[t.dataset.pr] = Object.assign(S.co[t.dataset.pr] || {}, { pr: t.value, in: t.value === 'Skip' ? 0 : 1 }); save(); renderAll() }
});
let nT = null; document.addEventListener('input', e => { const t = e.target; if (t.dataset.n) { S.n[t.dataset.n] = t.value; clearTimeout(nT); nT = setTimeout(save, 600) } });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-co],[data-mod],[data-day],[data-mock],[data-quiz],[data-sl],[data-eoi],[data-close]'); if (!t) return;
  if (t.dataset.close) return closeModal();
  if (t.dataset.eoi) return eoiForm();
  if (t.dataset.sl) { e.stopPropagation(); const c = coById(t.dataset.sl); setStatus(c.id, isSL(c) ? 'Awaiting shortlist' : 'Shortlisted'); return }
  if (t.dataset.go) { const g = t.dataset.go; if (g.includes('#')) { const [a, b] = g.split('#'); const base = a.startsWith('study:') ? 'm-' + a.slice(6) : a; location.hash = base + '#' + b; return } go(g); return }
  if (t.dataset.co) { go('co:' + t.dataset.co); return }
  if (t.dataset.mod) { curMod = t.dataset.mod; location.hash = 'm-' + curMod; return }
  if (t.dataset.day) { S.n._day = t.dataset.day; save(); renderToday(); return }
  if (t.dataset.mock) { location.hash = 'practice'; setTimeout(() => { $('#pCo').value = t.dataset.mock; $('#pType').value = 'CV grill'; askQ() }, 60); return }
  if (t.dataset.quiz) { const tp = topicById(t.dataset.quiz); location.hash = 'practice'; setTimeout(() => { $('#pType').value = tp.mod === 'guess' ? 'Guesstimate' : tp.mod === 'case' ? 'Case' : tp.mod === 'story' ? 'Behavioural / HR' : 'Role knowledge'; askQ({ question: tp.q, looking_for: [] }) }, 60); return }
});
window.addEventListener('pagehide', () => { if (saveT) flush() });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveT) flush() });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
boot().catch(e => { console.error(e); $('#boot').innerHTML = '<p class="muted">Could not load. Check your connection and reopen.</p>' });
