# REFYN — System Architecture
### Doc 1 of 4 · Foundation for scalability, error handling, and responsive design

---

## 1. GUIDING PRINCIPLES

Every architectural decision serves these five goals, in order:

1. **Scalable** — adding a new exam (SSC, GMAT) or feature must be additive, never a rewrite
2. **Isolated** — features don't reach into each other; a bug in the doubt board can't break practice sessions
3. **Swappable** — data layer is abstracted so mock → Supabase → future backend is a one-file change per feature
4. **Recoverable** — every async operation has a defined failure path; the app never shows a blank white screen
5. **Mobile-first, desktop-safe** — designed for 375px, degrades gracefully up to desktop without breaking

**Lessons carried from Oryn (do NOT repeat):**
- No monolithic App.tsx holding all logic
- No client-side-writable security flags (is_pro must be server-only)
- No inline Supabase calls scattered through components
- No hardcoded colors (killed theming; see Theming doc)

---

## 2. HIGH-LEVEL LAYER MODEL

The app is built in four strict layers. Data flows down, events flow up. A layer may only call the layer directly below it.

```
┌──────────────────────────────────────────────┐
│  PRESENTATION LAYER                            │
│  (React components, screens, UI)               │
│  Knows nothing about Supabase or data sources  │
└──────────────────────────────────────────────┘
                     ↓ calls
┌──────────────────────────────────────────────┐
│  STATE LAYER                                   │
│  (Zustand stores + React Query for server data)│
│  Holds app state, caches server data           │
└──────────────────────────────────────────────┘
                     ↓ calls
┌──────────────────────────────────────────────┐
│  SERVICE LAYER                                 │
│  (/src/services/ — pure functions)             │
│  The ONLY layer that knows about Supabase      │
│  Swappable: mock ↔ real backend                │
└──────────────────────────────────────────────┘
                     ↓ calls
┌──────────────────────────────────────────────┐
│  DATA LAYER                                    │
│  (Supabase client, Edge Functions, external)   │
└──────────────────────────────────────────────┘
```

**The golden rule:** A React component never imports the Supabase client. Ever. It calls a hook, the hook calls a service, the service calls Supabase. This is what makes the whole thing swappable and testable.

---

## 3. FOLDER STRUCTURE

```
src/
├── app/                          # App shell, routing, providers
│   ├── App.tsx                   # Thin — just providers + router
│   ├── router.tsx                # Route definitions + guards
│   ├── providers.tsx             # QueryClient, Theme, Auth providers
│   └── AuthGuard.tsx             # Protected route wrapper
│
├── features/                     # Feature modules — isolated
│   ├── dashboard/
│   │   ├── components/           # Feature-specific components
│   │   ├── hooks/                # Feature-specific hooks
│   │   ├── DashboardView.tsx     # Main view
│   │   └── index.ts              # Public exports only
│   ├── practice/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── PracticeConfigView.tsx
│   │   ├── PracticeSessionView.tsx
│   │   ├── PracticeReviewView.tsx
│   │   └── index.ts
│   ├── flashcards/
│   ├── board/
│   ├── profile/
│   ├── auth/
│   └── onboarding/
│
├── services/                     # THE ONLY place Supabase is imported
│   ├── supabase/
│   │   └── client.ts             # Supabase client init
│   ├── auth.service.ts
│   ├── profile.service.ts
│   ├── questions.service.ts
│   ├── sessions.service.ts
│   ├── weakness.service.ts
│   ├── doubts.service.ts
│   ├── flashcards.service.ts
│   └── payments.service.ts
│
├── stores/                       # Zustand global state
│   ├── userStore.ts              # profile, auth session, isPro
│   ├── sessionStore.ts           # active practice session state
│   ├── examStore.ts              # selected exam (CAT/SSC/etc)
│   └── themeStore.ts             # dark/light theme
│
├── hooks/                        # Shared hooks (React Query wrappers)
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useWeaknessScores.ts
│   ├── useDoubts.ts
│   └── useTheme.ts
│
├── components/                   # Shared, reusable UI (design system)
│   ├── ui/                       # Button, Card, Badge, Input, Modal, etc.
│   ├── layout/                   # AppLayout, BottomNav, Sidebar, Header
│   └── feedback/                 # ErrorBoundary, Toast, Spinner, EmptyState
│
├── lib/                          # Pure utilities, no side effects
│   ├── errors.ts                 # Error types + handling utilities
│   ├── format.ts                 # Date, number, time formatters
│   ├── validation.ts             # Input validation helpers
│   └── constants.ts              # App-wide constants
│
├── types/                        # TypeScript types + interfaces
│   ├── database.types.ts         # Generated from Supabase
│   ├── domain.types.ts           # App domain models
│   └── api.types.ts              # Service request/response shapes
│
├── styles/                       # Theme tokens (see Theming doc)
│   ├── tokens.css                # CSS variables — dark + light
│   └── globals.css
│
└── config/
    └── env.ts                    # Typed env variable access
```

**Why this structure scales:**
- Adding a feature = adding a folder under `features/`. Nothing else changes.
- Adding an exam = data change, not code change (see Database doc).
- Every feature is self-contained — its components, hooks, and view live together.
- `index.ts` in each feature exports only what other parts of the app may use — enforces isolation.

---

## 4. STATE MANAGEMENT STRATEGY

Two kinds of state, handled differently — this distinction matters:

### Client state → Zustand
State the app owns: which theme is active, current practice session progress, selected exam, UI toggles.

```
stores/
├── userStore      → session, profile snapshot, isPro flag (read-only mirror)
├── sessionStore   → active session: current Q index, answers, timer, streak
├── examStore      → currently selected exam (CAT default)
└── themeStore     → 'dark' | 'light', persisted to localStorage
```

### Server state → React Query (TanStack Query)
Data that lives in Supabase: weakness scores, questions, doubts, profile. React Query handles caching, refetching, loading/error states, and stale-while-revalidate automatically.

**Why both, not just Zustand:** Server data needs caching, background refetch, and automatic loading/error states. Hand-rolling that in Zustand is how you get bugs. React Query is purpose-built for it. Zustand handles only genuine client state.

**Rule:** If the data comes from Supabase, it goes through React Query, never manually into Zustand. Zustand mirrors only lightweight derived values (like `isPro`) for synchronous access.

---

## 5. DATA FLOW EXAMPLE (end to end)

User opens Dashboard, sees weakness scores:

```
1. DashboardView renders
2. Calls useWeaknessScores() hook
3. Hook uses React Query: useQuery(['weakness', userId], ...)
4. Query calls weaknessService.getScores(userId)
5. Service calls supabase.from('weakness_scores').select()
6. Data returns → React Query caches it → hook returns { data, isLoading, error }
7. DashboardView renders based on state:
   - isLoading → <SkeletonRadar />
   - error → <ErrorState onRetry={refetch} />
   - data → <WeaknessRadar data={data} />
```

Component never touches Supabase. Loading and error states are first-class, not afterthoughts.

---

## 6. ERROR HANDLING STRATEGY

Error handling is a cross-cutting concern with four levels. Every level has a defined behavior.

### Level 1 — Service layer (catch + normalize)
Every service function wraps its call and throws a **typed** error, never a raw Supabase error.

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public userMessage: string,   // safe to show user
    public originalError?: unknown // for logging only
  ) { super(userMessage) }
}

export type ErrorCode =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'PAYMENT_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN'
```

```typescript
// services/weakness.service.ts
export const getScores = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('weakness_scores').select('*').eq('user_id', userId)
    if (error) throw new AppError('NETWORK_ERROR',
      "Couldn't load your weakness data. Check your connection.", error)
    return data
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError('UNKNOWN', 'Something went wrong.', e)
  }
}
```

**Never let a raw Supabase/Postgres error reach the UI.** Users see `userMessage`; logs get `originalError`.

### Level 2 — React Query (retry + surface)
- Network errors → auto-retry 2× with backoff
- Auth errors → no retry, redirect to login
- Every `useQuery` returns `error` — components render an error state from it
- Global `onError` in QueryClient logs to console (later: Sentry)

### Level 3 — Component error states (graceful UI)
Every data-driven view handles three states explicitly:

```
isLoading → skeleton (never a blank screen)
error     → <ErrorState message={error.userMessage} onRetry={refetch} />
empty     → <EmptyState /> (no data yet — e.g. no doubts posted)
success   → the actual content
```

### Level 4 — Error Boundary (last resort)
A top-level `<ErrorBoundary>` catches any render crash and shows a recovery screen ("Something broke. Reload.") instead of React's white screen of death. Wrap each feature route in its own boundary so one feature crashing doesn't kill the whole app.

### Toast strategy
- Success actions (doubt posted, payment complete) → success toast
- Recoverable errors (failed to post) → error toast with retry
- Validation errors → inline under the field, NOT toast

---

## 7. RESPONSIVE STRATEGY (mobile-first, desktop-safe)

Primary target: 375px mobile PWA. Desktop must stay usable, not pixel-perfect.

### Breakpoints (Tailwind defaults)
```
base   → 0–639px    Mobile (PRIMARY — design here first)
sm     → 640px+     Large phones / small tablets
md     → 768px+     Tablets
lg     → 1024px+    Desktop
```

### Navigation switches by breakpoint
- **Mobile (base–md):** Fixed bottom tab bar (5 tabs) — the primary pattern
- **Desktop (lg+):** Left sidebar navigation, content in a centered max-width column

```
components/layout/
├── AppLayout.tsx      → decides: <BottomNav/> below lg, <Sidebar/> at lg+
├── BottomNav.tsx      → mobile tab bar
├── Sidebar.tsx        → desktop side nav
└── Header.tsx         → top bar (greeting, notifications)
```

### Content width discipline
- Mobile: full width, 16px side padding
- Desktop: content capped at `max-w-2xl` (672px) centered — a study app shouldn't stretch questions across a 1920px monitor; it hurts readability
- Radar chart, cards, question views: all scale within that capped column

### Rule for building
Write mobile styles as the base class. Add desktop overrides only with `lg:` prefix. Never design desktop-first and shrink down.

```
// Correct
<div className="flex flex-col lg:flex-row">

// Wrong (desktop-first)
<div className="flex flex-row max-lg:flex-col">
```

---

## 8. ROUTING & GUARDS

React Router v6+. Real URL routes (not hash routing — doubt threads must be shareable).

```
/login                    public
/onboarding               protected (new users)
/dashboard                protected
/practice                 protected
/practice/session         protected
/practice/review          protected
/flashcards               protected
/flashcards/:topicId      protected
/board                    protected
/board/new                protected (Pro for posting)
/board/:doubtId           protected
/profile                  protected
/profile/upgrade          protected
```

- `<AuthGuard>` wraps all protected routes — no session → redirect `/login`
- Onboarding guard — profile incomplete → redirect `/onboarding`
- Each route lazy-loaded (`React.lazy`) for code splitting — faster initial load on mobile

---

## 9. PERFORMANCE BASELINE (mobile-critical)

CAT aspirants are often on mid-range Android + patchy data. Non-negotiable:

- **Code splitting** — each feature route lazy-loaded, not one giant bundle
- **Timer via useRef** — practice session timer must not re-render the component every tick (Oryn lesson)
- **React Query caching** — weakness scores, questions cached; don't refetch on every mount
- **Skeleton screens** — never blank while loading; perceived speed matters
- **Optimistic updates** — marking a doubt answer "helpful" updates UI instantly, syncs after
- **Image discipline** — doubt board images lazy-loaded, compressed, max 2MB
- **Font loading** — `font-display: swap` so text renders before fonts finish

---

## 10. WHAT GETS BUILT WHERE (quick reference)

| Concern | Lives in | Never in |
|---|---|---|
| Supabase calls | `services/` | components, hooks |
| Server data caching | React Query hooks | Zustand |
| Client UI state | Zustand stores | React Query |
| Colors / theme | CSS tokens | component classes |
| Error normalization | `services/` + `lib/errors.ts` | components |
| Error display | `components/feedback/` | scattered inline |
| Business logic | feature hooks | view components |
| Routing | `app/router.tsx` | features |
| Types | `types/` | inline in components |

---

*Doc 1 of 4 — Architecture. Next: Database design (multi-exam schema), Theming (dark + light tokens), Build Phases.*
