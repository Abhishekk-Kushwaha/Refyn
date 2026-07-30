// Daily focus coaching — the "why this concept, today" message on the dashboard.
//
// Division of labour, and the reason this is cheap:
//   * The AWE engine PICKS the concept. It already ranks weakness using real
//     accuracy, recency and CAT frequency. Deterministic, free, instant.
//   * This function only WRITES THE PROSE around that pick.
//
// Because the engine supplies the choice, the prose depends solely on the
// situation — concept + weakness band — never on the individual. So one
// generation is reused by every learner in that state, and the cache key is
// (concept, band) rather than user_id. See the migration for the arithmetic.
//
// The message must therefore stay qualitative: the dashboard renders the
// learner's actual accuracy and attempt counts next to it.
//
// Deploy:  npx supabase functions deploy daily-focus --no-verify-jwt
//
// verify_jwt is off for the same reason as ai-explain: with it on, the
// platform answers the CORS preflight before this code runs and its reply
// carries no Access-Control-Allow-Origin. Auth is enforced below instead.

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

const MODEL_POOL = ['google/gemini-3.6-flash', 'google/gemini-3.5-flash-lite'];
const GEMINI_MODEL = 'gemini-3.6-flash';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const UPSTREAM_TIMEOUT_MS = 20_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Band = 'critical' | 'weak' | 'learning' | 'improving' | 'strong' | 'untested';
type FrequencyBand = 'low' | 'medium' | 'high' | 'very_high';

interface FocusRequest {
  conceptKey?: string;
  conceptName?: string;
  topicName?: string;
  band?: Band;
  frequencyBand?: FrequencyBand;
}

const VALID_BANDS: Band[] = ['critical', 'weak', 'learning', 'improving', 'strong', 'untested'];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const restHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

const cacheEnabled = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

const readCache = async (conceptKey: string, band: string): Promise<string | null> => {
  if (!cacheEnabled) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/coaching_messages` +
      `?concept_key=eq.${encodeURIComponent(conceptKey)}` +
      `&band=eq.${encodeURIComponent(band)}&select=message&limit=1`;
    const res = await fetch(url, { headers: restHeaders });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.message ?? null;
  } catch (e) {
    console.error('cache read failed', e);
    return null;
  }
};

const writeCache = async (row: {
  conceptKey: string;
  conceptName: string;
  band: string;
  frequencyBand?: string;
  message: string;
  model: string;
}) => {
  if (!cacheEnabled) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/coaching_messages`, {
      method: 'POST',
      headers: { ...restHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({
        concept_key: row.conceptKey,
        concept_name: row.conceptName,
        band: row.band,
        frequency_band: row.frequencyBand ?? null,
        message: row.message,
        model: row.model,
      }),
    });
  } catch (e) {
    console.error('cache write failed', e);
  }
};

/** Same contract as ai-explain's requireUser — see that file for the rationale. */
const requireUser = async (req: Request): Promise<string | null> => {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  if (!token || token === ANON_KEY || token === req.headers.get('apikey')) return null;
  const apikey = req.headers.get('apikey') || ANON_KEY;
  if (!apikey) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey },
    });
    if (!res.ok) return null;
    return (await res.json())?.id ?? null;
  } catch (e) {
    console.error('auth check failed', e);
    return null;
  }
};

const SYSTEM_PROMPT = `You are a CAT quantitative aptitude coach writing the single
line of motivation a learner sees when they open the app.

You are told which concept the app's engine has selected, how weak the learner
is at it (a band, not a number), and how often it appears in CAT papers.

Rules:

1. Write 2 sentences. Under 45 words total. This sits in a small card.
2. NEVER state a specific percentage, accuracy, score, attempt count, or number
   of papers. You are not given the learner's real figures and must not invent
   them - the app displays the true numbers next to your text. Speak
   qualitatively: "well below where you need it", "close to solid", "shows up
   constantly".
3. Sentence one: why this concept is worth today's effort, tying its CAT
   frequency to their current level.
4. Sentence two: a concrete, doable action for today. Direct and encouraging,
   never patronising, never guilt-tripping.
5. Address the learner as "you". Plain text only - no markdown, no LaTeX, no
   headings, no emoji.
6. Do not open with the concept name as a bare label, and do not greet. Start
   with the substance.`;

const FREQUENCY_PHRASE: Record<FrequencyBand, string> = {
  very_high: 'appears in almost every CAT paper',
  high: 'appears frequently in CAT papers',
  medium: 'appears fairly regularly in CAT papers',
  low: 'appears occasionally in CAT papers',
};

const BAND_PHRASE: Record<Band, string> = {
  critical: 'is one of their weakest areas - they get most of these wrong',
  weak: 'is a clear weak spot - they get more wrong than right',
  learning: 'is still shaky - they are inconsistent on it',
  improving: 'is trending upward but not yet reliable',
  strong: 'is already strong - this is about keeping it sharp',
  untested: 'has not been practised yet, so it is an unknown',
};

const buildPrompt = (r: Required<Pick<FocusRequest, 'conceptName' | 'band'>> & FocusRequest) => {
  const freq = r.frequencyBand ? FREQUENCY_PHRASE[r.frequencyBand] : 'appears in CAT papers';
  return [
    `Concept: ${r.conceptName}${r.topicName ? ` (part of ${r.topicName})` : ''}`,
    `CAT frequency: this concept ${freq}.`,
    `Learner's level: it ${BAND_PHRASE[r.band]}.`,
    '',
    'Write the two-sentence focus message.',
  ].join('\n');
};

/** Calls OpenRouter when configured, else Gemini directly. Returns [text, model]. */
const generate = async (prompt: string, signal: AbortSignal): Promise<[string, string]> => {
  if (OPENROUTER_API_KEY) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://refyn.io',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        models: MODEL_POOL, // plural enables failover; a single `model` does not
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 300,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return [(data?.choices?.[0]?.message?.content ?? '').trim(), data?.model ?? MODEL_POOL[0]];
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 800,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal,
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? '')
    .join('')
    .trim();
  return [text, GEMINI_MODEL];
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const userId = await requireUser(req);
  if (!userId) return json({ error: 'Please sign in again.' }, 401);

  if (!OPENROUTER_API_KEY && !GEMINI_API_KEY) {
    console.error('no model key configured');
    return json({ error: 'Coaching is not configured yet.' }, 500);
  }

  let body: FocusRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const conceptName = body.conceptName?.trim();
  const conceptKey = body.conceptKey?.trim() || conceptName;
  if (!conceptName || !conceptKey) return json({ error: 'conceptName is required.' }, 400);
  if (!body.band || !VALID_BANDS.includes(body.band)) {
    return json({ error: 'a valid band is required.' }, 400);
  }

  const cached = await readCache(conceptKey, body.band);
  if (cached) return json({ message: cached, cached: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const prompt = buildPrompt({ ...body, conceptName, band: body.band });
    const [message, model] = await generate(prompt, controller.signal);
    if (!message) return json({ error: 'Empty coaching message.' }, 502);

    await writeCache({
      conceptKey,
      conceptName,
      band: body.band,
      frequencyBand: body.frequencyBand,
      message,
      model,
    });

    return json({ message, cached: false });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    console.error('daily-focus failed', aborted ? 'upstream timeout' : e);
    // The dashboard degrades to engine-only copy, so a soft failure is fine.
    return json({ error: 'Coaching unavailable right now.' }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
