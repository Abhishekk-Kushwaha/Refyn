# REFYN — Adaptive Weakness Engine (AWE)

### Doc 5 · The complete engine spec — built client-first, then moved to the database

---

## 0. THE ONE-LINE GOAL

> A student fails a question. Refyn notices *which concept* it belongs to, *how much
> that concept matters for CAT*, and *whether the failure is a pattern or a fluke* —
> then it keeps feeding that student the right mix of that concept (real questions +
> generated look-alikes + flashcards) until they can solve it back-to-back, quietly
> retires the concept once mastered, and never fully forgets it was once a weakness —
> reviving it lightly before the exam.

Everything below is the machinery that makes that sentence true, at any cost, faithfully.

---

## 1. HOW THIS MAPS TO YOUR VISION (nothing dropped)

| Your words | The mechanism that delivers it |
|---|---|
| "user not able to solve a question" | every attempt is scored per **concept** (= subtopic) |
| "identify that question's relevance / how frequent" | `frequency_weight` (per subtopic) × `topic_weight` (per topic) |
| "not able to solve that topic's questions **back to back** → weak" | **`consecutive_incorrect ≥ 2`** trigger (Rule R001) |
| "create quiz of that topic + replica questions" | **quiz queue** filled with real + verified replica questions |
| "combined quiz smoothly adds the weak concept" | **daily blended quiz**: 70% weak / 20% revision / 10% mixed (R007) |
| "flashcards, simple interactive, master the concept" | SM-2 flashcards auto-generated per weak concept (R010/R011) |
| "when he can solve it → auto opt him out of that topic" | `mastered` state → concept leaves the active weak pool (R005) |
| "but that topic always be a weakness … before CAT give related questions" | **`ever_was_very_weak` permanent flag** + pre-CAT revival (R009) |
| "Arithmetic + Algebra extreme priority, Geometry a bit, little Modern/Number" | `topic_weight`: 1.0 / 0.95 / 0.70 / 0.45 / 0.40 baked into every score |

If any row above ever stops being true in the build, the build is wrong. This table is the contract.

---

## 2. GRANULARITY (locked)

Tracking happens at the **subtopic level** = one "concept" = one `concept_code`
(e.g. `TW_SINGLE`, `PERC_SUCCESSIVE`). This was decided in Database doc §13 and is not
revisited here. "Topic" (Arithmetic, Algebra…) is the *parent* used only for weighting
and the radar. All mastery, all rules, all queue entries operate on **concepts**.

---

## 3. THE PER-CONCEPT RECORD (the heart)

One row per `(user, concept)`. This is `concept_mastery` in the DB; client-first it's the
same shape in local state. Every rule reads and writes this.

```
ConceptMastery {
  conceptId            // subtopic id
  topicId, topicWeight // parent topic + its CAT weight (1.0 … 0.40)
  frequencyWeight      // this concept's exam frequency (1.3 … 0.4)

  // raw signal
  attempts             // total answered (skips never count)
  correct, incorrect
  accuracy             // correct / attempts × 100
  consecutiveCorrect   // resets to 0 on any wrong
  consecutiveIncorrect // resets to 0 on any right  ← powers "back-to-back"
  last10               // rolling window of the last 10 results (for mastery)

  // computed
  masteryScore         // 0–100, how well they OWN it (rises slowly, falls fast)
  weaknessScore        // how loudly it should be practiced NOW
  priorityWeight       // what the queue sorts by

  // lifecycle
  status               // the state machine, §4
  everWasWeak          // permanent once true
  everWasVeryWeak      // permanent once true  ← the "always a weakness" flag
  firstWeakAt, resolvedAt, daysToMaster, timesReopened

  lastAttemptAt, lastUpdated
}
```

**Two different scores, on purpose:**
- **`weaknessScore`** = `(1 − accuracy/100) × frequencyWeight × topicWeight × recency` → drives the *dashboard ranking* ("what's my biggest problem").
- **`masteryScore`** = a slower, memory-aware number (§5) → drives *lifecycle decisions* ("is this actually fixed, or just a lucky streak").

You need both. Weakness answers "what hurts most"; mastery answers "can I let go yet."

---

## 4. THE LIFECYCLE STATE MACHINE

```
                         first attempt (any result)
        unattempted ─────────────────────────────► learning
                                                       │
                          back-to-back fail on a       │ quiz < 60%
                          high-value topic (R001)       ▼
              learning ──────────────────────────►  weak ──────────► very_weak
                                                       ▲                 │
                                    quiz < 60% (R003)  │                 │ quiz ≥ 80% (R004)
                                                       │                 ▼
                                                       │            improving
                                                       │                 │ last-10 ≥ 85% (R005)
                            revision failed 2× (R006)  │                 ▼
                                                       └──────────  mastered ──┐
                                                                          │    │ was ever very_weak
                                                                          │    ▼
                                                                          │  (mastered + old_weakness flag)
                                                                          ▼
                                                       pre-CAT window → light revival (R009)
```

**Transition table (this is the whole brain):**

| From | To | Condition | Rule |
|---|---|---|---|
| unattempted | learning | first attempt on the concept, any result | R002 base |
| learning / weak | **very_weak** | `consecutiveIncorrect ≥ 2` AND `attempts ≥ 3` AND `accuracy < 50` AND `topicWeight ≥ 0.70` | **R001** |
| learning | weak | concept quiz accuracy `< 60%` | R003 |
| weak / very_weak | improving | concept quiz accuracy `≥ 80%` | R004 |
| improving | mastered | last-10 accuracy `≥ 85%` AND `attempts ≥ 10` | R005 |
| mastered | old_weakness (flag) | on reaching mastered, if `everWasVeryWeak` | R005b |
| mastered | weak | a scheduled revision fails **twice in a row** | R006 |

Notes that make it match your vision exactly:
- **R001 is the "back-to-back" rule.** Two misses in a row on an important concept is the
  trigger — not a slow accuracy drift. That's your "not able to solve back to back → weak."
- **R001 only fires on high-value topics** (`topicWeight ≥ 0.70` = Arithmetic, Algebra, Geometry).
  A stumble in Number System doesn't get the full very-weak treatment — matching "extreme
  priority on Arithmetic and Algebra."
- **mastered = auto opt-out.** A mastered concept stops being injected into the daily quiz.
  The student is "opted out of that topic" — automatically, exactly as you described.
- **`everWasVeryWeak` is permanent.** Even after mastery, the concept carries the scar. That
  flag is what R009 reads before CAT.

---

## 5. THE MASTERY SCORE (rises slow, falls fast)

Mastery must not swing on one lucky answer. Formula, updated on every attempt:

```
target = accuracy(last10)                       // where they are on recent form
if correct:  masteryScore += (target - masteryScore) × 0.30   // ease up toward it
if wrong:    masteryScore  = masteryScore × 0.70              // sharp drop
masteryScore = clamp(0, 100, masteryScore)
```

- One wrong answer knocks 30% off — a single slip visibly dents mastery, so "mastered" is earned.
- Recovery is gradual — three or four clean answers to climb back. This asymmetry is deliberate:
  it's the difference between "got lucky once" and "actually owns it."

`priorityWeight = topicWeight × frequencyWeight × (1 − masteryScore/100)` — this is what the
quiz queue sorts by, so **Arithmetic/Algebra weak concepts always rise to the top of the queue.**

---

## 6. THE DAILY BLENDED QUIZ (your "combined quiz")

When the student taps "Practice" (or their daily quiz), the engine composes a session that
**smoothly mixes** their weaknesses instead of drilling one topic to death. Composition (R007,
from `awe_config`):

```
70%  →  weak / very_weak concepts, Arithmetic & Algebra first
        (highest priorityWeight; each concept gets real + verified-replica questions)
20%  →  revision: 'improving' concepts + recently-mastered ones due for a check
10%  →  mixed: a fresh/under-practiced concept for coverage (prevents tunnel vision)
```

Example — a 10-question daily quiz: 7 questions pulled from the top weak concepts (say 3 on
Time-Speed-Distance, 2 on Quadratic Roots, 2 on Profit-Loss), 2 revision questions on a concept
they're improving at, 1 wildcard. As concepts get mastered and opt out, the 70% automatically
refills from the next-weakest — the quiz **stays targeted without the student ever configuring it.**

The queue is pre-built (the engine writes `quiz_queue` rows with a `reason` and `priority`), so
serving the quiz is a fast read, not a live computation. Server-side later; a pure function now.

---

## 7. REPLICA QUESTIONS (the reinforcement multiplier)

A student who fails *one* Profit-Loss question needs *more* Profit-Loss questions than the bank
holds. Replicas are generated look-alikes of the exact questions they missed.

**Lifecycle (never served unverified):**
```
draft → auto_checked → (human_reviewed) → verified → eligible for the queue
                    ↘ auto_failed → discarded, never shown
```
- Generated (later: Gemini) from the parent question the user failed, same concept & difficulty.
- **Independently re-solved** and the answer cross-checked before it can be `verified`. A wrong
  replica is worse than no replica, so this gate is non-negotiable.
- Only `verified` replicas enter `quiz_queue`. Enforced at the query level, not by convention.

**Client-first stand-in:** until Gemini + verification exist, each seeded concept ships with 2–3
hand-authored "variant" questions tagged as pre-verified replicas. The engine treats them
identically, so the queue/blending logic is fully exercised now and the generator drops in later
with zero changes to the consuming code.

---

## 8. FLASHCARD LOGIC (SM-2, tied into mastery)

Flashcards are the "simple interactive, master the concept" layer. They use **SM-2** (the Anki
algorithm) so review spacing adapts to the student.

**Per-user-per-card state:** `easeFactor` (start 2.5), `intervalDays` (start 1),
`consecutiveCorrect`, `nextReviewAt`, `mastery` (new → learning → reviewing → mastered).

**On "Got it" (R011):**
```
consecutiveCorrect += 1
if consecutiveCorrect ≥ 3:  interval steps 3 → 7 → 14 → 30 → 60 days   (fast-track once it sticks)
else:                       interval = round(interval × easeFactor)
nextReviewAt = today + interval
if interval ≥ 30: mastery = 'mastered'
```

**On "Not sure" (R010):**
```
consecutiveCorrect = 0
easeFactor = max(1.3, easeFactor − 0.20)   // this card is hard → shrink spacing
intervalDays = 1                            // see it again tomorrow
mastery = 'learning'
```

**How flashcards feed the engine (the important part):**
- When a concept flips to `weak`/`very_weak`, the engine **auto-queues that concept's flashcards**
  (R001 queues 3, R002 queues 1). The student sees them surfaced weakest-first.
- Flashcards are **auto-generated from `tricks`** via a DB trigger (Database doc §14.1) — write a
  shortcut once, its flashcard exists automatically. Client-first, we seed cards directly.
- Consistent "Got it" on a concept's cards is a *positive mastery signal* that nudges
  `masteryScore` up between quizzes — so revision genuinely contributes to opting the concept out,
  not just quiz performance.
- A card that keeps getting "Not sure" is a flag the concept isn't really improving even if quiz
  luck says otherwise — a guard against false mastery.

---

## 9. OLD WEAKNESS & PRE-CAT REVIVAL (R009)

The scar never fully heals, on purpose.

- Any concept that was ever `very_weak` keeps `everWasVeryWeak = true` **forever**, even after mastery.
- Inside the `cat_countdown_revival_days` window (default **30 days** before the exam date), the
  daily quiz's 10% "mixed" slice is preferentially filled with these old scars — one light question
  here and there. Not a full re-drill (they mastered it), just a "you once struggled here, prove
  it's still solid" touch.
- If they miss a revival question, the concept can drop back to `weak` (R006 path) and re-enter the
  active pool — the safety net catches regression right before it matters most.

This is your "that topic always be a weakness … before CAT we give him a little of that related
questions," enforced by a flag in data, not by anyone remembering.

---

## 10. THE TRIGGERS (when the engine runs)

The engine is not always-on; it fires at three well-defined moments (Database doc §10):

| Trigger | Fires | Rules it runs |
|---|---|---|
| `onAttemptSaved` | after every single answer | R001 (back-to-back), R002 (first-wrong) |
| `onSessionCompleted` | when a quiz/session ends | R003, R004, R005, R006, R012 (housekeeping) |
| `dailyTick` | once a day per active user | R007 (build tomorrow's quiz), R008, R009 (pre-CAT), R010/R011 flashcard scheduling |

Client-first, `dailyTick` runs on app open if a day has passed since the last run. Server-side later,
it's a scheduled cron / Edge Function. **Same rule functions, different trigger** — that's the whole
point of building the logic pure.

---

## 11. CONFIG (tune without touching code — already in your DB)

Every threshold above is a row in `awe_config` (already seeded in `master_setup.sql`), so the whole
system's behavior is tunable with a single value change, no redeploy:

```
very_weak_accuracy_threshold      50    consecutive_incorrect trigger     2   (add this row)
very_weak_min_attempts             3    weak_quiz_accuracy_threshold      60
improving_quiz_accuracy_threshold 80    mastered_accuracy_threshold       85
mastered_lookback_attempts        10    cat_countdown_revival_days        30
daily_quiz_weak_topic_pct         70    daily_quiz_revision_pct           20
daily_quiz_mixed_pct              10
```

Client-first, these live in one `aweConfig.ts` constant object with the identical keys, so moving
them to the DB later is a lookup swap.

---

## 12. BUILD STRATEGY — complete engine first, database second

The rule logic is **identical** whether it runs in the browser or in a Supabase Edge Function. So we
build and *prove* the whole engine as pure, testable functions over a local store, then swap only the
persistence. Nothing about the rules changes when the DB arrives.

**Stage A — Engine core (pure functions, no UI, fully unit-tested)**
```
src/engine/
  aweConfig.ts          the thresholds (§11)
  types.ts              ConceptMastery, QueueItem, FlashcardState…
  masteryScore.ts       §5 formula
  rules.ts              R001–R012 as pure (state, event, config) → new state + actions
  quizBuilder.ts        §6 blended 70/20/10 composition
  flashcardSM2.ts       §8 SM-2
  engine.ts             the three triggers (§10) orchestrating the rules
```
These functions take state in and return new state + a list of side-effect *intentions*
("queue 5 replicas of concept X", "schedule review in 3 days"). They touch nothing else — which is
why they're trivially testable and portable.

**Stage B — Local persistence adapter**
A `store` interface (get/save concept, enqueue, read queue). First implementation: localStorage.
The engine calls the interface, never storage directly.

**Stage C — Wire into the existing app**
- `onAttemptSaved` fires from the practice session (already emitting answers).
- Dashboard reads mastery/weakness from the engine's state instead of the current simple scorer.
- "Daily quiz" / Practice reads the blended queue.
- Flashcards feature (Phase 5) reads the SM-2 scheduler.

**Stage D — Verify the full loop end-to-end in the browser**
Fail a concept back-to-back → watch it go `very_weak`, get replicas + flashcards queued → practice it
up → watch it hit `mastered` and leave the pool → simulate the pre-CAT window → watch the scar revive.
This is the acceptance test. It must pass before any database work.

**Stage E — Database swap (the *only* thing Phase 1 changes about the engine)**
- Replace the localStorage store adapter with a Supabase one (same interface).
- Move the three triggers into Edge Functions (`awe-engine`, `generate-replica`) — paste the *same*
  rule functions in.
- `aweConfig.ts` → reads the `awe_config` table.
- Add the real replica generator (Gemini) + verification behind the already-built `verified` gate.

Because Stages A–D never import storage or Supabase, Stage E cannot break the logic — it can only
change where the numbers live.

---

## 13. ACCEPTANCE CHECKLIST (the engine is "done" when all pass)

- [ ] Two wrong answers in a row on an Arithmetic concept (≥3 attempts, <50%) → `very_weak`, and
      replicas + flashcards get queued for it.
- [ ] The same pattern on a Number System concept does **not** trigger the full very-weak path
      (low topic weight) — priority stays with Arithmetic/Algebra.
- [ ] A daily quiz is 70/20/10 weak/revision/mixed, Arithmetic & Algebra weak concepts first.
- [ ] Practicing a very_weak concept up to ≥85% last-10 → `mastered` → it stops appearing in the
      daily quiz (auto opt-out).
- [ ] A mastered concept that was once very_weak keeps `everWasVeryWeak` and reappears lightly in the
      pre-CAT window.
- [ ] Failing a revival/revision twice reopens the concept to `weak`.
- [ ] Flashcard "Got it" ×3 fast-tracks the interval; "Not sure" shrinks ease and resets to tomorrow.
- [ ] Consistent flashcard success nudges masteryScore up between quizzes.
- [ ] Everything above runs client-side today and survives the Supabase swap unchanged.

---

*Doc 5 · AWE Engine. Build order: this spec → engine core (Stage A–D, client-first) → database + Edge
Functions (Stage E). The rules never change across that line; only where the state lives does.*
