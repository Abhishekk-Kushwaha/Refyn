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

// Choosing the concept with thinking turned up measures ~13s, and this runs
// once per learner per day. A generous ceiling beats abandoning a good pick.
const UPSTREAM_TIMEOUT_MS = 45_000;

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
  /** The whole weakness profile, weakest first. */
  concepts?: ConceptSnapshot[];
  /** Section-level rollups, computed client-side from the same profile. */
  topics?: TopicRollup[];
}

/** One concept's state. Keys are short because this is stored per user per day. */
interface ConceptSnapshot {
  k: string; // concept key
  n: string; // name
  t: string; // topic
  a: number; // accuracy 0-100
  at: number; // attempts
  m: number; // mastery score 0-100
  s: string; // status
  sk?: number; // skips
  tr?: number | null; // avg time ratio; >1 = correct but slow
  ro?: number; // times reopened
  ci?: number; // consecutive incorrect
  vw?: boolean; // ever was very weak
  sc?: number; // mean seconds on answers they got right
  si?: number; // mean seconds on answers they got wrong
}

interface TopicRollup {
  name: string;
  accuracy: number;
  attempts: number;
}

/** How many concepts to describe. Beyond this the prompt stops earning its tokens. */
const MAX_CONCEPTS_IN_PROMPT = 12;

/** Yesterday's snapshot, used to describe what moved. */
interface PriorFocus {
  focus_date: string;
  concept_key: string;
  concept_name: string;
  concept_accuracy: number | null;
  concept_attempts: number | null;
  overall_accuracy: number | null;
  total_attempts: number | null;
  snapshot: ConceptSnapshot[] | null;
}

/**
 * What actually moved between two profiles.
 *
 * Computed here, in code, and handed to the model as finished statements.
 * The model is asked to find patterns across these — never to derive them.
 * Asking a language model to subtract percentages is how you get a confident
 * wrong number in front of a student.
 */
interface ConceptDelta {
  name: string;
  topic: string;
  accuracyChange: number;
  attemptsAdded: number;
}

const diffProfiles = (
  now: ConceptSnapshot[],
  before: ConceptSnapshot[]
): { improved: ConceptDelta[]; regressed: ConceptDelta[]; untouched: string[] } => {
  const priorByKey = new Map(before.map((c) => [c.k, c]));
  const improved: ConceptDelta[] = [];
  const regressed: ConceptDelta[] = [];
  const untouched: string[] = [];

  for (const c of now) {
    const p = priorByKey.get(c.k);
    if (!p) continue; // new since last visit — not a change, just new
    const accuracyChange = Math.round(c.a - p.a);
    const attemptsAdded = Math.max(0, c.at - p.at);
    if (attemptsAdded === 0) {
      // Worth naming: a weak concept nobody touched is a different problem
      // from one that was practised and still slipped.
      if (c.s === 'weak' || c.s === 'very_weak') untouched.push(c.n);
      continue;
    }
    const d: ConceptDelta = { name: c.n, topic: c.t, accuracyChange, attemptsAdded };
    if (accuracyChange >= 5) improved.push(d);
    else if (accuracyChange <= -5) regressed.push(d);
  }

  improved.sort((a, b) => b.accuracyChange - a.accuracyChange);
  regressed.sort((a, b) => a.accuracyChange - b.accuracyChange);
  return { improved, regressed, untouched };
};

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
const readToday = async (
  userId: string,
  date: string
): Promise<{ message: string; concept_key: string; concept_name: string } | null> => {
  if (!cacheEnabled) return null;
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/daily_focus` +
      `?user_id=eq.${encodeURIComponent(userId)}&focus_date=eq.${encodeURIComponent(date)}` +
      `&select=message,concept_key,concept_name&limit=1`;
    const res = await fetch(url, { headers: restHeaders });
    if (!res.ok) return null;
    return (await res.json())?.[0] ?? null;
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
      `&select=focus_date,concept_key,concept_name,concept_accuracy,concept_attempts,overall_accuracy,total_attempts,snapshot` +
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

const SYSTEM_PROMPT = `You are a CAT quantitative aptitude coach. You do two jobs
once a day, when the learner opens the app.

JOB ONE - CHOOSE THE CONCEPT

You are given their full profile. Choose the ONE concept they should work on
today and return its exact key. Think it through properly before deciding;
accuracy matters far more than speed here.

Weigh these against each other rather than ranking on any single one:

  * Score impact. A concept that appears in almost every CAT paper is worth
    more than an equally weak one that rarely appears.
  * Room to move. Something at very low accuracy with real attempts behind it
    has more headroom than something already near mastery.
  * Fragility. A concept marked re-broken has failed to stick before and may
    need attention ahead of a first-time weakness.
  * Pacing. A concept they answer correctly but far too slowly is a genuine
    weakness even though accuracy looks healthy.
  * Avoidance. Heavy skips, or a weak concept untouched since last time,
    means the gap is not closing on its own.
  * Evidence. A concept with only one or two attempts is barely measured. Do
    not crown it the top weakness on that alone when a well-evidenced
    weakness is available.
  * Momentum. Something moving up may deserve one more session to lock in,
    rather than being abandoned mid-climb.

Choose from the supplied concepts ONLY. Never invent a concept name or key.

JOB TWO - WRITE THE BRIEFING

Write the briefing for the concept YOU chose above.

Rules:

1. Write 3 to 4 sentences. Under 80 words total. This sits in a small card.
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

USING THE FULL PROFILE

You are given every concept they have practised, section rollups, and a
precomputed list of what rose and fell. Read across it and say the most
useful true thing. Patterns worth surfacing when the data shows them:

  * A whole section sagging, not just one concept.
  * Something they fixed that has since come apart, especially a concept
    marked as re-broken.
  * A concept marked slow: they are getting it right but too slowly to
    survive a real paper. That is a pacing problem, not a knowledge one, and
    is worth naming as such.
  * Time sunk into wrong answers. When the average seconds on wrong answers
    is far higher than on right ones, they are grinding at questions they do
    not have a method for. In a timed paper that is the costliest habit
    there is: the marks are lost and the minutes are gone too. Say so, and
    the fix is recognising it early and moving on, not trying harder.
  * A weak concept they have been avoiding - high skips, or listed as not
    practised since last time.
  * Progress in one area while another slipped, when both appear.

Constraints on this:

  * Report only patterns visible in the data given. Never speculate about
    causes you cannot see - time of day, mood, study habits, or anything
    outside these numbers.
  * All the arithmetic is already done. The rises and falls are given to you
    as finished statements. Never compute your own.
  * Pick ONE pattern - the most useful. This is a short card, not a report.
  * A single weak concept with very few attempts is not yet a pattern. Say so
    plainly rather than over-reading it.
7. Address the learner as "you". Plain text only - no markdown, no LaTeX, no
   headings, no bullet points, no emoji.
8. Say, in passing, why this concept over the others - one clause is enough.
   The learner should understand the choice, not just receive it.

OUTPUT FORMAT

Reply with JSON only, no code fence:

  {"conceptKey": "<exact key of the concept you chose>", "message": "<the briefing>"}

conceptKey must match one of the supplied keys character for character.
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
  // The engine's own top pick is offered as a reference point, not an
  // instruction — the model is free to overrule it, and is told as much.
  const lines: string[] = [
    `The engine's weakness ranking puts ${r.conceptName}` +
      `${r.topicName ? ` (${r.topicName})` : ''} first. It ${BAND_PHRASE[r.band]},` +
      ` and ${freq}. You may choose differently if the profile below justifies it.`,
  ];

  const acc = pct(r.conceptAccuracy);
  if (acc) lines.push(`Their accuracy on it right now: ${acc} over ${r.conceptAttempts ?? 0} attempts.`);
  const overall = pct(r.overallAccuracy);
  if (overall) lines.push(`Their overall accuracy: ${overall} across ${r.totalAttempts ?? 0} questions.`);

  // The candidate set. Every concept carries its key, because the model has
  // to return one of these verbatim — it is choosing, not just describing.
  if (r.concepts?.length) {
    lines.push('');
    lines.push(
      `CANDIDATE CONCEPTS (${r.concepts.length} practised, engine's weakness order). ` +
        'Choose exactly one of these keys:'
    );
    for (const c of r.concepts.slice(0, MAX_CONCEPTS_IN_PROMPT)) {
      const bits = [`${c.a}% over ${c.at} attempts`, `mastery ${c.m}`, c.s];
      if (c.sk) bits.push(`${c.sk} skipped`);
      // >1.15 means they get there, but too slowly to finish a real paper.
      if (c.tr != null && c.tr > 1.15) bits.push(`slow (${c.tr.toFixed(1)}x expected time)`);
      if (c.ro) bits.push(`re-broken ${c.ro}x`);
      if (c.ci && c.ci >= 3) bits.push(`${c.ci} wrong in a row`);
      if (c.vw) bits.push('was once very weak');
      // Time sunk into wrong answers is the expensive kind. Surfaced next to
      // the time spent when right, so the contrast is visible.
      if (c.sc != null) bits.push(`avg ${c.sc}s when right`);
      if (c.si != null) bits.push(`avg ${c.si}s when WRONG`);
      lines.push(`  key="${c.k}" | ${c.n} [${c.t}] - ${bits.join(', ')}`);
    }
    if (r.concepts.length > MAX_CONCEPTS_IN_PROMPT) {
      lines.push(
        `  (${r.concepts.length - MAX_CONCEPTS_IN_PROMPT} further concepts are stronger than all of these and are not candidates.)`
      );
    }
  }

  if (r.topics?.length) {
    lines.push('');
    lines.push('BY SECTION:');
    for (const t of r.topics) lines.push(`  ${t.name}: ${t.accuracy}% over ${t.attempts} questions`);
  }

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

    // Every concept that moved, not just today's focus. All subtraction done
    // above in diffProfiles; these are finished facts, not raw material.
    if (prior.snapshot?.length && r.concepts?.length) {
      const { improved, regressed, untouched } = diffProfiles(r.concepts, prior.snapshot);
      if (improved.length) {
        lines.push('  WENT UP since then:');
        for (const d of improved.slice(0, 5)) {
          lines.push(`    ${d.name} [${d.topic}] up ${d.accuracyChange} points over ${d.attemptsAdded} new attempts`);
        }
      }
      if (regressed.length) {
        lines.push('  WENT DOWN since then:');
        for (const d of regressed.slice(0, 5)) {
          lines.push(`    ${d.name} [${d.topic}] down ${Math.abs(d.accuracyChange)} points over ${d.attemptsAdded} new attempts`);
        }
      }
      if (untouched.length) {
        lines.push(`  Still weak and NOT practised since: ${untouched.slice(0, 5).join(', ')}`);
      }
      if (!improved.length && !regressed.length) {
        lines.push('  No concept moved by more than 5 points either way.');
      }
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

interface Choice {
  conceptKey: string;
  message: string;
}

/**
 * Parses the model's JSON reply, tolerating a stray code fence.
 * Returns null rather than throwing so the caller can fall back cleanly.
 */
const parseChoice = (raw: string): Choice | null => {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const o = JSON.parse(cleaned);
    if (typeof o?.conceptKey === 'string' && typeof o?.message === 'string') {
      return { conceptKey: o.conceptKey.trim(), message: o.message.trim() };
    }
  } catch {
    /* fall through */
  }
  console.error('could not parse model reply', cleaned.slice(0, 200));
  return null;
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
        // Reasoning models spend this budget before writing a word, so it has
        // to cover both. See the Gemini branch for the measurement.
        max_tokens: 6000,
        response_format: { type: 'json_object' },
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
          // output, so the budget has to cover both. Choosing the concept is
          // a judgement call across a dozen candidates, so thinking is turned
          // up and the ceiling raised to match. This runs once per learner
          // per day, and getting the choice right beats getting it fast.
          maxOutputTokens: 6000,
          thinkingConfig: { thinkingLevel: 'high' },
          responseMimeType: 'application/json',
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

  // Already briefed today — every further login today is free, and returns
  // the SAME concept. That is what stops a refresh reshuffling the pick.
  const todays = await readToday(userId, today);
  if (todays) {
    return json({
      message: todays.message,
      conceptKey: todays.concept_key,
      conceptName: todays.concept_name,
      cached: true,
    });
  }

  const prior = await readPrior(userId, today);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const prompt = buildPrompt({ ...body, conceptKey, conceptName, band: body.band }, prior, today);
    const [raw, model] = await generate(prompt, controller.signal);
    const choice = parseChoice(raw);
    if (!choice?.message) return json({ error: 'Empty coaching message.' }, 502);

    // Trust the model's judgement, not its spelling. The key it returns must
    // exist in the profile we sent; a hallucinated concept would render a card
    // whose Drill button leads nowhere. On a miss we keep the engine's pick,
    // which is always valid, rather than failing the whole briefing.
    const chosen = body.concepts?.find((c) => c.k === choice.conceptKey);
    if (!chosen && choice.conceptKey) {
      console.error(
        `model chose unknown concept key "${choice.conceptKey}" — falling back to engine pick "${conceptKey}"`
      );
    }
    const finalKey = chosen?.k ?? conceptKey;
    const finalName = chosen?.n ?? conceptName;
    const message = choice.message;

    // user_id comes from the verified JWT, never from the request body.
    await writeToday({
      user_id: userId,
      focus_date: today,
      concept_key: finalKey,
      concept_name: finalName,
      band: body.band,
      concept_accuracy: chosen?.a ?? body.conceptAccuracy ?? null,
      concept_attempts: chosen?.at ?? body.conceptAttempts ?? null,
      overall_accuracy: body.overallAccuracy ?? null,
      total_attempts: body.totalAttempts ?? null,
      // Stored whole, not truncated to MAX_CONCEPTS_IN_PROMPT: tomorrow's diff
      // should see every concept that moved, including ones too strong to be
      // worth describing today.
      snapshot: body.concepts ?? null,
      message,
      model,
    });

    return json({
      message,
      conceptKey: finalKey,
      conceptName: finalName,
      // True when the model overruled the engine's ranking.
      overrodeEngine: finalKey !== conceptKey,
      cached: false,
      hadPrior: Boolean(prior),
    });
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
