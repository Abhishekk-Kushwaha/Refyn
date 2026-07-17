# REFYN — Premium Exam Prep PWA

> Hunt your weakness. Own the exam.

A mobile-first SPA for exam preparation (starting with CAT) featuring an AI-powered weakness detection engine, spaced-repetition flashcards, and a peer doubt-board. Built with React 19, TypeScript, Tailwind CSS v4, Supabase, and Framer Motion.

## Architecture Principles

1. **Scalable** — Adding exams (SSC, GMAT) is a data change, not code
2. **Isolated** — Feature modules don't depend on each other
3. **Swappable** — Data layer abstracted via services
4. **Recoverable** — Every async operation has a defined error path
5. **Mobile-first, desktop-safe** — Responsive from 375px to 1920px

See `/files` for complete design docs:
- `01-architecture.md` — System design & folder structure
- `02-database-v2.md` — Schema with AWE engine & replica pipeline
- `03-theming.md` — Dark/light theme token system
- `04-build-phases.md` — Build plan (0–8, phases currently at 0)

## Project Structure

```
src/
├── app/              # App shell, routing, providers
├── features/         # Feature modules (phase 2+)
├── services/         # Supabase abstraction layer (phase 1+)
├── stores/           # Zustand global state
├── components/       # Shared UI library + layout
│   ├── ui/          # Base components (Button, Card, etc.)
│   └── feedback/    # Error handling (ErrorBoundary, Toast, etc.)
├── hooks/           # React Query + custom hooks
├── lib/             # Pure utilities (errors, formatting, validation)
├── types/           # TypeScript domain types
├── config/          # Environment config
└── styles/          # Tokens + global CSS
```

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
# Install dependencies
npm install --legacy-peer-deps

# Create .env.local
cp .env.example .env.local
# Fill in your Supabase credentials

# Start dev server
npm run dev

# Type check
npm run type-check

# Build
npm run build
```

The app opens at `http://localhost:5173`.

## Phase 0 — Foundation ✅

What's been built:
- ✅ Vite + React 19 + TypeScript scaffold
- ✅ Tailwind v4 with semantic token system (dark/light themes)
- ✅ Complete folder structure
- ✅ Base UI component library:
  - Button (variants: primary, secondary, ghost, danger)
  - Card (with header, title, description, content, footer)
  - Badge (color-coded)
  - Input / Textarea (with validation)
  - Modal (animated, centered)
  - Spinner / PageLoader
  - Skeleton (shimmer animation)
- ✅ Feedback components:
  - ErrorBoundary (render crash recovery)
  - Toast (success/error/info notifications)
  - EmptyState & ErrorState (data-driven UX)
- ✅ Theme system:
  - Zustand store (persist to localStorage)
  - No flash on load (inline script in `index.html`)
  - Smooth theme transitions (200ms)
- ✅ React Query + Toast providers wired in
- ✅ Error handling library (`lib/errors.ts`)
- ✅ Environment config
- ✅ Landing page (hero, theme toggle, status)

### Done Criteria (Phase 0)
- [x] App runs, shows styled shell
- [x] Dark/light toggle works and persists
- [x] No hardcoded colors (all via tokens)
- [x] Every base UI component renders in both themes
- [x] ErrorBoundary catches errors
- [x] TypeScript compiles clean

## Phase 1 — Database + Auth (next)

Will add:
- Supabase project creation
- Full schema + RLS policies
- Google OAuth flow
- Auth service + useAuth hook
- Login screen
- AuthGuard protecting routes
- Auto-profile creation on signup

## Next Steps

1. **Phase 1 prep:** Set up Supabase, create schema, seed taxonomy
2. **Auth implementation:** Google OAuth, login screen, onboarding
3. **Phase 2:** Shell + navigation (bottom tabs mobile, sidebar desktop)
4. **Phase 3:** Practice session engine (the core product)
5. **Phase 4:** Dashboard + weakness detection

## Design System

### Tokens
- **Dark (default):** Deep blacks (#09090b), warm whites (#fafafa), amber accent (#f59e0b)
- **Light:** Clean whites (#fff), dark grays, darker amber (#d97706)
- **Typography:** Space Grotesk (display), Inter (body), JetBrains Mono (mono)
- **Spacing:** 4px grid (xs:4, sm:8, md:12, lg:16, xl:24, 2xl:32, 3xl:48)

### Components
All components use semantic tokens (no hardcoded colors). Theme toggle updates CSS custom properties instantly.

### Motion
- **Transitions:** 200–300ms, ease curves, no jank
- **Loaders:** Shimmer animation (2s cycle)
- **Interactions:** Scale on tap (0.95x), color shifts, ripples

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Deployment

Built for Vercel. Environment variables needed:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

```bash
npm run build
vercel deploy
```

## License

Proprietary — Abhishek Kushwaha

---

**Last Updated:** Phase 0 complete  
**Next Milestone:** Phase 1 (Auth + Database)
