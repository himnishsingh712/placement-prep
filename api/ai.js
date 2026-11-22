// Server-side AI for mock interviews and resume parsing.
// The Anthropic key lives only in Vercel's environment (ANTHROPIC_API_KEY). Prompts are fixed here,
// so the app can't be used as a general chatbot. Each user gets 20 calls a day (about 10 scored answers); everyone together 60.
const SB_URL = 'https://towxfwpgywxbqfrppidu.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvd3hmd3BneXd4YnFmcnBwaWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5OTM2NTQsImV4cCI6MjExMDU2OTY1NH0.WAsgBwGN3bN46GzMPziMpjmZtHeBrFLh3kaRpV4SfYs';
const FAST = 'claude-haiku-5-5', SMART = 'claude-sonnet-5-5';
const MINE_CAP = 20, ALL_CAP = 60;

async function claude(model, system, user, max_tokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens, system, messages: [{ role: 'user', content: user }] })
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || 'AI error');
  return (j.content || []).map(c => c.text || '').join('');
}
const json = t => { const s = t.indexOf('{'), e = t.lastIndexOf('}'); return JSON.parse(t.slice(s, e + 1)) };
const co = c => c ? `Company: ${c.name}. Role: ${c.role}${c.team ? ' (' + c.team + ')' : ''}. JD focus: ${c.jd || 'n/a'}. Likely themes: ${c.expect || 'n/a'}.` : 'General final-placement interview for an MBA (marketing) student at MICA, India.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI key not set', code: 'no_key' });
  const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return res.status(401).json({ error: 'Sign in first' });
  const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, authorization: 'Bearer ' + tok } });
  if (!u.ok) return res.status(401).json({ error: 'Session expired, sign in again' });
  const b = await fetch(SB_URL + '/rest/v1/rpc/pp_bump_ai', { method: 'POST', headers: { apikey: SB_KEY, authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: '{}' });
  const n = b.ok ? await b.json() : { mine: 0, total: 0 };
  if (n.mine > MINE_CAP || n.total > ALL_CAP) return res.status(429).json({ error: 'Daily AI limit reached', code: 'cap' });

  const { task, payload: p = {} } = req.body || {};
  try {
    if (task === 'question') {
      const t = await claude(FAST, 'You are a sharp, fair interviewer at an Indian B-school final placement. Reply with JSON only.',
        `${co(p.company)}\nCandidate CV: ${String(p.cv || '').slice(0, 5000)}\nAsk exactly ONE "${p.type}" question suited to this company and role. CV grill: pick one specific CV line and probe it hard (numbers, method, own contribution). Guesstimate or Case: a crisp prompt an interviewer here would plausibly use, often linked to the candidate's CV or the company's business. Why this company: probe motivation and fit. Avoid these recent questions: ${(p.recent || []).join(' || ') || 'none'}.\nReturn JSON: {"question":"...","looking_for":["3 to 5 short points a strong answer covers"]}`, 400);
      return res.json(json(t));
    }
    if (task === 'evaluate') {
      const t = await claude(SMART, 'You coach MBA candidates for Indian campus placement interviews. Be blunt, specific and fair. Plain text only.',
        `${co(p.company)}\nCandidate CV: ${String(p.cv || '').slice(0, 5000)}\nQuestion (${p.type}): ${p.question}\nA strong answer covers: ${(p.looking_for || []).join('; ') || 'use your judgement'}\nCandidate's answer: """${String(p.answer || '').slice(0, 4000)}"""\n\nGive feedback in exactly this format, under 220 words:\n**Score:** x/10\n**What worked:** 1–2 lines\n**What was missing:** 2–3 bullets\n**Stronger structure:** a 3–5 step skeleton for this answer (not a script)\n**Follow-up they would ask:** one question`, 700);
      return res.json({ text: t });
    }
    if (task === 'parse_resume') {
      const t = await claude(FAST, 'You turn an MBA student\'s resume into interview-prep pointers. Reply with JSON only. Never invent facts that are not in the resume.',
        `Resume text:\n"""${String(p.text || '').slice(0, 14000)}"""\n\nSplit it into every individual bullet or claim an interviewer could ask about (work, internships, projects, positions of responsibility, achievements, skills). For each, give: s = section label like "Company · Role (dates)", t = the line as written (lightly cleaned), k = the numbers and terms to be ready on, q = 3 likely interview questions. Also give a 2-line summary of the candidate.\nReturn JSON: {"summary":"...","pointers":[{"id":"p1","s":"...","t":"...","k":"...","q":["...","...","..."]}]}`, 6000);
      const cv = json(t); (cv.pointers || []).forEach((x, i) => x.id = 'p' + (i + 1));
      return res.json({ cv });
    }
    return res.status(400).json({ error: 'Unknown task' });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 200) });
  }
}
