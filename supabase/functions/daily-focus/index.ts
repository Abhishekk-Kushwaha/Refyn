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
  /** Learner's local date, YYYY-MM-DD. Their midnight, not UTC's. */
  localDate?: string;
  /** Today's stats, used for the message and stored as tomorrow's baseline. */
  conceptAccuracy?: number;
  conceptAttempts?: number;
  overallAccuracy?: number;
  totalAttempts?: number;
}

/** Yesterday's snapshot, used to describe what moved. */
interface PriorFocus {
  focus_date: string;
  concept_key: string;
  concept_name: string;
  concept_accuracy: number | null;
  concept_attempts: number | null;
  overall_accuracy: number | null;
  total_attempts: number | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Today's row, if the learner has already opened the app today. */
const readToday = async (userId: string, date: string): Promise<string | null> => {
  if (!cacheEnabled) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/daily_focus` +
      `?user_id=eq.${encodeURIComponent(userId)}&focus_date=eq.${encodeURIComponent(date)}` +
      `&select=message&limit=1`;
    const res = await fetch(url, { headers: restHeaders });
    if (!res.ok) return null;
    return (await res.json())?.[0]?.message ?? null;
  } catch (e) {
    console.error('daily read failed', e);
    return null;
  }
};

/**
 * The most recent earlier day. Not necessarily yesterday — learners skip
 * days, and "since you were last here" is the honest comparison anyway.
 */
const readPrior = async (userId: string, date: string): Promise<PriorFocus | null> => {
  if (!cacheEnabled) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/daily_focus` +
      `?user_id=eq.${encodeURIComponent(userId)}&focus_date=lt.${encodeURIComponent(date)}` +
      `&select=focus_date,concept_key,concept_name,concept_accuracy,concept_attempts,overall_accuracy,total_attempts` +
      `&order=focus_date.desc&limit=1`;
    const res = await fetch(url, { headers: restHeaders });
    if (!res.ok) return null;
    return (await res.json())?.[0] ?? null;
  } catch (e) {
    console.error('prior read failed', e);
    return null;
  }
};

const writeToday = async (row: Record<string, unknown>) => {
  if (!cacheEnabled) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/daily_focus`, {
      method: 'POST',
      // Two tabs opening at once must not both insert.
      headers: { ...restHeaders, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (e) {
    console.error('daily write failed', e);
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

const SYSTEM_PROMPT = `You are a CAT quantitative aptitude coach writing the short
briefing a learner sees once a day when they open the app.

You are told which concept the app's engine selected for today, their real
figures on it, how often it appears in CAT papers, and - when they have been
here before - what their figures were last time.

Rules:

1. Write 2 to 3 sentences. Under 60 words total. This sits in a small card.
2. Use ONLY figures you are given. Never invent an accuracy, a score, or a
   count of papers. Rounding what you are given is fine. If a figure is
   absent, describe it qualitatively instead.
3. When prior figures are supplied, open by naming what actually moved -
   improvement or slippage - and be straight about it. Do not congratulate
   someone whose numbers fell, and do not manufacture progress that is not in
   the data. A flat number is worth saying plainly.
4. When there are no prior figures, this is their first briefing: skip the
   comparison entirely rather than referring to a past you cannot see.
5. Then say why today's concept earns the effort, tying its CAT frequency to
   where they currently stand.
6. Finish with one concrete action for today. Direct and encouraging, never
   patronising, never guilt-tripping, no false urgency.
7. Address the learner as "you". Plain text only - no markdown, no LaTeX, no
   headings, no bullet points, no emoji.
8. Do not greet and do not open with a bare label. Start with the substance.`;

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

const pct = (n: number | null | undefined): string | null =>
  n === null || n === undefined ? null : `${Math.round(n)}%`;

const daysBetween = (from: string, to: string): number =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));

const buildPrompt = (
  r: Required<Pick<FocusRequest, 'conceptName' | 'band'>> & FocusRequest,
  prior: PriorFocus | null,
  today: string
): string => {
  const freq = r.frequencyBand ? FREQUENCY_PHRASE[r.frequencyBand] : 'appears in CAT papers';
  const lines: string[] = [
    `Today's concept: ${r.conceptName}${r.topicName ? ` (part of ${r.topicName})` : ''}`,
    `CAT frequency: this concept ${freq}.`,
    `Their level: it ${BAND_PHRASE[r.band]}.`,
  ];

  const acc = pct(r.conceptAccuracy);
  if (acc) lines.push(`Their accuracy on it right now: ${acc} over ${r.conceptAttempts ?? 0} attempts.`);
  const overall = pct(r.overallAccuracy);
  if (overall) lines.push(`Their overall accuracy: ${overall} across ${r.totalAttempts ?? 0} questions.`);

  if (prior) {
    const gap = daysBetween(prior.focus_date, today);
    lines.push('');
    lines.push(
      `LAST TIME THEY WERE HERE (${gap === 1 ? 'yesterday' : `${gap} days ago`}):`
    );
    lines.push(`  Focus concept was: ${prior.concept_name}`);
    const pAcc = pct(prior.concept_accuracy);
    if (pAcc) lines.push(`  Their accuracy on that concept then: ${pAcc} over ${prior.concept_attempts ?? 0} attempts.`);
    const pOverall = pct(prior.overall_accuracy);
    if (pOverall) lines.push(`  Their overall accuracy then: ${pOverall} across ${prior.total_attempts ?? 0} questions.`);

    // Spell the comparison out rather than trusting the model to subtract.
    if (prior.concept_key === r.conceptKey && prior.concept_accuracy != null && r.conceptAccuracy != null) {
      const delta = Math.round(r.conceptAccuracy - prior.concept_accuracy);
      lines.push(
        `  Same concept as today. Change in accuracy on it: ${
          delta > 0 ? `up ${delta} points` : delta < 0 ? `down ${Math.abs(delta)} points` : 'unchanged'
        }.`
      );
    } else {
      lines.push('  Different concept from today.');
    }
    if (prior.total_attempts != null && r.totalAttempts != null) {
      lines.push(`  Questions attempted since then: ${Math.max(0, r.totalAttempts - prior.total_attempts)}.`);
    }
  } else {
    lines.push('');
    lines.push('NO PRIOR VISIT ON RECORD - this is their first briefing. Do not reference the past.');
  }

  lines.push('');
  lines.push("Write today's briefing.");
  return lines.join('\n');
};

/** Thrown when the model ran out of budget mid-sentence — see generate(). */
class TruncatedError extends Error {}

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
        // Reasoning models spend this budget before writing a word, so it has
        // to cover both. See the Gemini branch for the measurement.
        max_tokens: 2500,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    if (data?.choices?.[0]?.finish_reason === 'length') throw new TruncatedError('openrouter');
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
          // Thinking tokens count against this and are spent BEFORE any
          // output. Measured on this prompt: ~1,100 thinking tokens for a
          // ~60 token briefing. At 800 the model burned 765 on thought and
          // returned 31 tokens — a sentence cut in half. 2500 leaves room.
          maxOutputTokens: 2500,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      signal,
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (data?.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new TruncatedError('gemini');
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

  // The learner's own date. Anything malformed falls back to UTC rather than
  // silently writing a row under the wrong day.
  const today =
    body.localDate && ISO_DATE.test(body.localDate)
      ? body.localDate
      : new Date().toISOString().slice(0, 10);

  // Already briefed today — every further login today is free.
  const todays = await readToday(userId, today);
  if (todays) return json({ message: todays, cached: true });

  const prior = await readPrior(userId, today);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const prompt = buildPrompt({ ...body, conceptKey, conceptName, band: body.band }, prior, today);
    const [message, model] = await generate(prompt, controller.signal);
    if (!message) return json({ error: 'Empty coaching message.' }, 502);

    // user_id comes from the verified JWT, never from the request body.
    await writeToday({
      user_id: userId,
      focus_date: today,
      concept_key: conceptKey,
      concept_name: conceptName,
      band: body.band,
      concept_accuracy: body.conceptAccuracy ?? null,
      concept_attempts: body.conceptAttempts ?? null,
      overall_accuracy: body.overallAccuracy ?? null,
      total_attempts: body.totalAttempts ?? null,
      message,
      model,
    });

    return json({ message, cached: false, hadPrior: Boolean(prior) });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    // Truncated text is never written: generate() throws before writeToday, so
    // a half-sentence cannot get frozen in as the whole day's briefing.
    if (e instanceof TruncatedError) console.error('daily-focus: truncated completion', e.message);
    else console.error('daily-focus failed', aborted ? 'upstream timeout' : e);
    // The dashboard degrades to engine-only copy, so a soft failure is fine.
    return json({ error: 'Coaching unavailable right now.' }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
