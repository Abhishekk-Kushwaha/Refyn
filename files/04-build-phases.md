# REFYN — Build Phases
### Doc 4 of 4 · Ordered, shippable sequence — build in this order, no skipping

---

## THE PHILOSOPHY

Build in layers that each stand on their own. Every phase ends with something that *works* — not a pile of half-finished features. You should be able to stop after any phase and have a stable app. This prevents the Oryn problem of everything being half-built and interdependent.

**Rule: Do not start a phase until the previous phase's "Done Criteria" are all met.**

Each phase below is a self-contained instruction you can hand to Antigravity one at a time.

---

## PHASE 0 — FOUNDATION (no features yet)
*Goal: The skeleton everything hangs on. Boring but critical.*

**Build:**
1. Vite + React 19 + TypeScript project
2. Tailwind v4 configured with the semantic token system (from Theming doc) — primitives + semantic tokens + dark/light
3. Folder structure exactly as Architecture doc specifies (`app/`, `features/`, `services/`, `stores/`, `hooks/`, `components/`, `lib/`, `types/`, `styles/`)
4. Base UI component library in `components/ui/`: Button, Card, Badge, Input, Modal, Spinner, Skeleton
5. Feedback components in `components/feedback/`: ErrorBoundary, ErrorState, EmptyState, Toast
6. `lib/errors.ts` — AppError class + error codes
7. Theme system fully working — toggle switches dark/light, persists, no flash on load
8. React Query + Zustand providers wired in `app/providers.tsx`
9. Env config (`config/env.ts`) typed access to env vars

**Done Criteria:**
- [ ] App runs, shows a blank themed shell
- [ ] Dark/light toggle works and persists across refresh
- [ ] No hardcoded colors anywhere — all via tokens
- [ ] Every base UI component renders correctly in both themes
- [ ] ErrorBoundary catches a deliberately thrown error and shows recovery UI
- [ ] TypeScript compiles clean, no errors

**Why first:** Nothing can be built well without this. Theming retrofitted later = disaster (Oryn proved it).

---

## PHASE 1 — DATABASE + AUTH
*Goal: Real backend, real login. No app features yet, but the foundation is live.*

**Build:**
1. Create Supabase project (region: ap-south-1 Mumbai)
2. Run full multi-exam schema from Database doc (exams → sections → topics → subtopics → questions → all user tables)
3. Enable RLS with all policies — especially the `is_pro` server-only lock
4. Auto-create-profile trigger on signup
5. Seed script: CAT exam → QA section → 6 topics → full Arithmetic subtopic taxonomy (with concepts[] and frequency data)
6. Google OAuth in Supabase + Google Cloud Console
7. Auth service (`services/auth.service.ts`) + `useAuth` hook
8. Login screen wired to real Google OAuth
9. AuthGuard protecting routes
10. Generate TypeScript types from Supabase schema into `types/database.types.ts`

**Done Criteria:**
- [ ] Sign in with Google works end-to-end
- [ ] New user auto-gets a profile row
- [ ] Protected routes redirect to login when logged out
- [ ] Attempting to write `is_pro` from browser console is blocked by RLS (test this explicitly)
- [ ] CAT taxonomy is seeded and queryable
- [ ] Types are generated and imported

**Why second:** Auth + data structure must exist before any feature can store or read real data.

---

## PHASE 2 — ONBOARDING + APP SHELL + NAVIGATION
*Goal: A logged-in user can move around an empty-but-navigable app.*

**Build:**
1. Onboarding 3-step wizard (exam journey, weak areas, daily target) → writes to `user_exams` + marks `onboarding_complete`
2. Onboarding guard (incomplete profile → redirect to onboarding)
3. AppLayout with responsive nav: bottom tabs (mobile) / sidebar (desktop lg+)
4. All 5 route destinations exist as empty themed shells (Dashboard, Practice, Flashcards, Board, Profile)
5. Header component (greeting, notification bell placeholder)
6. Route transitions via Framer Motion AnimatePresence
7. Lazy-loading per route

**Done Criteria:**
- [ ] New user flows: login → onboarding → dashboard
- [ ] Returning user skips onboarding
- [ ] Bottom nav on mobile, sidebar on desktop, switches cleanly at lg breakpoint
- [ ] All 5 tabs navigate, transitions animate
- [ ] Works in both themes, no layout breaks at 375px or desktop

**Why third:** The container must exist before filling it with features.

---

## PHASE 3 — PRACTICE ENGINE (the core product)
*Goal: A user can actually practice questions. This is the heart of Refyn.*

**Build:**
1. Practice config screen (mode select: weakness/mock/topic, question count, timed/untimed)
2. Question selection service — pulls questions by subtopic from Supabase
3. Active session screen: question display (MCQ + TITA support), options, timer (useRef!), mark-for-review, skip
4. Answer reveal + solution display
5. Session save: writes `sessions` + `attempts` to Supabase
6. Session review screen: accuracy, by-topic breakdown, time insights
7. Handle both MCQ and TITA question types in the UI

**Done Criteria:**
- [ ] User completes a full practice session start to finish
- [ ] Attempts save correctly to database
- [ ] Timer works without re-rendering the question every second
- [ ] TITA questions accept typed input, MCQ shows options
- [ ] Session review shows accurate stats
- [ ] All error states handled (no questions available, network fail mid-session)

**Why fourth:** This is the product. Everything before was setup; this is the thing users pay for.

---

## PHASE 4 — WEAKNESS ENGINE + DASHBOARD
*Goal: The differentiator. Turn attempt data into the weakness insight.*

**Build:**
1. `recompute-weakness` Edge Function (the scoring algorithm: (1-accuracy) × frequency × recency)
2. Trigger recompute after each session completes
3. Weakness scores service + `useWeaknessScores` hook
4. Dashboard: hexagonal radar chart (Recharts, theme-aware colors)
5. Ranked weak-topics list (color-coded by score band)
6. "Today's progress" + recent activity
7. Wire "Start targeted drill" from a weak topic → practice session for that subtopic

**Done Criteria:**
- [ ] Completing a session updates weakness scores
- [ ] Radar chart renders real data, correct in both themes
- [ ] Weak topics ranked correctly by weakness score
- [ ] Tapping a weak topic starts a targeted drill
- [ ] Dashboard loads fast (reads precomputed scores, doesn't compute live)

**Why fifth:** Needs real attempt data (Phase 3) to be meaningful.

---

## PHASE 5 — FLASHCARDS
*Goal: Revision mode for weak topics.*

**Build:**
1. Flashcard service + seed some cards for Arithmetic subtopics
2. Flashcard list view (sorted by user's weak topics)
3. Swipeable card deck with 3D flip (Framer Motion)
4. "Not sure" / "Got it" → writes to `flashcard_progress`
5. Deck sorted weakest-first

**Done Criteria:**
- [ ] Cards flip, swipe, and re-queue correctly
- [ ] Weak topics' cards surface first
- [ ] Progress persists per user
- [ ] Works in both themes, smooth on mobile

**Why sixth:** Complements practice but isn't core. Ships independently.

---

## PHASE 6 — DOUBT BOARD (social)
*Goal: Async peer help, with credibility from quiz data.*

**Build:**
1. Doubt service (list, post, thread, answer)
2. Board list view with filter tabs (All/Unanswered/Mine)
3. Post doubt (concept auto-suggest, optional image via Supabase Storage)
4. Thread view with answers
5. Credibility badge (answerer's accuracy in that subtopic — reads weakness_scores)
6. Helpful votes (answer_votes table)
7. Mark resolved
8. In-app notification when your doubt gets answered

**Done Criteria:**
- [ ] Post a doubt, another account answers, appears in real time
- [ ] Credibility badges show correct accuracy per concept
- [ ] Helpful votes work, prevent duplicates
- [ ] Image upload works, capped at 2MB
- [ ] Empty states handled (no doubts yet)

**Why seventh:** Depends on weakness data (Phase 4) for credibility badges. Also fine to ship after core loop is proven.

---

## PHASE 7 — PROFILE + MONETIZATION
*Goal: Stats, subscription, and actually making money.*

**Build:**
1. Profile screen: stats, accuracy trend (Recharts line, theme-aware), topic breakdown, streak
2. Session history view
3. Settings (theme toggle, sign out)
4. Pricing/upgrade screen (Free / Pro Monthly ₹149 / Pro Yearly ₹999)
5. Razorpay integration: `create-razorpay-order` + `verify-razorpay-payment` Edge Functions
6. Server-side amount validation (never trust client)
7. Payment webhook → sets `is_pro` via service role
8. Paywall enforcement (free = 10 questions/day, board read-only, limited flashcards)
9. Payments audit table writes

**Done Criteria:**
- [ ] Payment flow works end-to-end in Razorpay test mode
- [ ] `is_pro` only ever set server-side (verify client can't)
- [ ] Amount validated server-side (can't be tampered)
- [ ] Paywall correctly gates free vs pro
- [ ] Payment recorded in payments table
- [ ] Pro status reflects immediately after payment

**Why eighth:** Monetization comes after the product is genuinely worth paying for. Gating an unproven app kills adoption.

---

## PHASE 8 — PWA + POLISH + LAUNCH PREP
*Goal: Make it installable, fast, and launch-ready.*

**Build:**
1. PWA manifest + service worker (vite-plugin-pwa)
2. App icons (amber R on dark)
3. Offline handling for flashcards (cache for travel use)
4. Performance pass: bundle analysis, lazy-load audit, image optimization
5. Loading skeletons everywhere data loads
6. Error logging (console now, Sentry-ready structure)
7. Meta tags, favicon, social preview
8. Final both-themes QA pass across every screen
9. Vercel deployment + env vars in production

**Done Criteria:**
- [ ] Installs to home screen on Android
- [ ] Flashcards work offline
- [ ] Lighthouse mobile score ≥ 90 performance
- [ ] No blank screens — skeletons everywhere
- [ ] Every screen verified in both themes
- [ ] Deployed to production on Vercel

**Why last:** Polish and installability matter only once the app is fully functional.

---

## PHASE DEPENDENCY MAP

```
Phase 0 (Foundation)
   ↓
Phase 1 (DB + Auth)
   ↓
Phase 2 (Shell + Nav + Onboarding)
   ↓
Phase 3 (Practice Engine) ←──────── THE CORE
   ↓
Phase 4 (Weakness + Dashboard) ←─── THE DIFFERENTIATOR
   ↓
   ├─→ Phase 5 (Flashcards)    ┐
   ├─→ Phase 6 (Doubt Board)   ├─ these three can flex in order
   └─→ Phase 7 (Monetization)  ┘   but all need Phases 0–4
   ↓
Phase 8 (PWA + Launch)
```

**Phases 0–4 are strictly sequential.** They build the core loop. Phases 5–7 all depend on 0–4 but are somewhat independent of each other — though the suggested order (flashcards → board → money) is deliberate: prove value before charging.

---

## MINIMUM SHIPPABLE PRODUCT

If you want to launch as early as possible to start validating with real users:

**MSP = Phases 0 through 4.** That gives you: login, onboarding, practice questions, and the weakness dashboard. That's the entire unique value proposition. You could put this in front of real CAT aspirants (starting with yourself) and learn whether the weakness engine actually changes how they study — before building flashcards, social, or payments.

Everything after Phase 4 is enhancement. The core bet — "does weakness-targeted practice help people" — is testable at the end of Phase 4.

---

## A NOTE ON HANDING THESE TO ANTIGRAVITY

Give Antigravity **one phase at a time.** Do not paste all 8 phases at once — that recreates the "build everything, half-finished" problem. Complete a phase, verify its Done Criteria yourself, then hand over the next. Reference the other three docs (Architecture, Database, Theming) as the rules each phase must follow.

---

*Doc 4 of 4 — Build Phases. This completes the planning set: Architecture, Database, Theming, Phases.*
