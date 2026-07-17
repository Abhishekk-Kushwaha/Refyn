# REFYN — Theming System
### Doc 3 of 4 · Dark + light theme, done with semantic tokens

---

## 1. THE CORE PRINCIPLE

**No component ever names a color.** Not `text-zinc-100`, not `bg-[#09090b]`, not `text-amber-500`. Components reference **semantic tokens** like `bg-surface`, `text-primary`, `border-default`. The token resolves to the right hex based on the active theme.

This is the one rule that makes dark + light actually work. The Oryn mistake was hardcoding colors everywhere — which made theming basically impossible to add later. Refyn does it right from line one.

```
❌ WRONG:  <div className="bg-zinc-900 text-zinc-100">
✅ RIGHT:  <div className="bg-surface text-primary">
```

When a component uses `bg-surface`, switching themes just swaps what `--surface` points to. Zero component changes.

---

## 2. TOKEN ARCHITECTURE (two layers)

### Layer 1 — Primitive tokens (raw values, never used directly in components)
The actual color palette. These are the "ingredients."

```css
/* styles/primitives.css */
:root {
  /* Neutrals */
  --zinc-950: #09090b;
  --zinc-900: #111113;
  --zinc-800: #1c1c1f;
  --zinc-700: #27272a;
  --zinc-600: #3f3f46;
  --zinc-500: #52525b;
  --zinc-400: #71717a;
  --zinc-300: #a1a1aa;
  --zinc-200: #d4d4d8;
  --zinc-100: #f4f4f5;
  --zinc-50:  #fafafa;
  --white:    #ffffff;

  /* Brand — amber (CAT gold) */
  --amber-600: #d97706;
  --amber-500: #f59e0b;
  --amber-400: #fbbf24;

  /* Semantic status */
  --red-500:   #ef4444;
  --red-400:   #f87171;
  --green-500: #22c55e;
  --green-400: #4ade80;
}
```

### Layer 2 — Semantic tokens (what components actually use)
These map meaning → primitive, and they change per theme.

```css
/* styles/tokens.css */

/* DARK THEME (default) */
:root, [data-theme="dark"] {
  --bg:              var(--zinc-950);   /* app background */
  --surface:         var(--zinc-900);   /* cards, panels */
  --surface-raised:  var(--zinc-800);   /* elevated cards, modals */
  --border:          var(--zinc-700);   /* dividers, card borders */
  --border-strong:   var(--zinc-600);

  --text-primary:    var(--zinc-50);    /* headings, main text */
  --text-secondary:  var(--zinc-300);   /* body, descriptions */
  --text-muted:      var(--zinc-500);   /* labels, metadata */

  --accent:          var(--amber-500);  /* primary brand */
  --accent-hover:    var(--amber-400);
  --accent-text:     var(--zinc-950);   /* text ON accent bg (dark on amber) */
  --accent-subtle:   #f59e0b1a;         /* amber tint bg (10% opacity) */

  --danger:          var(--red-500);    /* weak signal, errors */
  --danger-subtle:   #ef44441a;
  --success:         var(--green-500);  /* strong signal */
  --success-subtle:  #22c55e1a;

  --skeleton:        var(--zinc-800);   /* loading placeholders */
  --overlay:         #000000b3;         /* modal backdrop (70%) */
}

/* LIGHT THEME */
[data-theme="light"] {
  --bg:              var(--zinc-50);
  --surface:         var(--white);
  --surface-raised:  var(--white);
  --border:          var(--zinc-200);
  --border-strong:   var(--zinc-300);

  --text-primary:    var(--zinc-950);
  --text-secondary:  var(--zinc-700);
  --text-muted:      var(--zinc-500);

  --accent:          var(--amber-600);  /* slightly darker amber for contrast on white */
  --accent-hover:    var(--amber-500);
  --accent-text:     var(--white);      /* white text on amber in light mode */
  --accent-subtle:   #f59e0b14;         /* lighter tint (8%) */

  --danger:          var(--red-500);
  --danger-subtle:   #ef44440f;
  --success:         var(--green-500);
  --success-subtle:  #22c55e0f;

  --skeleton:        var(--zinc-200);
  --overlay:         #00000059;          /* lighter backdrop (35%) */
}
```

**Key insight on the accent:** In dark mode, text on the amber button is dark (`--zinc-950`). In light mode, amber-500 on white doesn't have enough contrast, so light mode uses `amber-600` with white text. This is the kind of detail that separates a real theme system from a broken one. The token handles it — components never think about it.

---

## 3. TAILWIND INTEGRATION

Map semantic tokens into Tailwind so classes like `bg-surface` work.

```js
/* tailwind.config.js (v4 uses CSS-based config, shown conceptually) */
theme: {
  extend: {
    colors: {
      bg:              'var(--bg)',
      surface:         'var(--surface)',
      'surface-raised':'var(--surface-raised)',
      border:          'var(--border)',
      'border-strong': 'var(--border-strong)',
      'text-primary':  'var(--text-primary)',
      'text-secondary':'var(--text-secondary)',
      'text-muted':    'var(--text-muted)',
      accent:          'var(--accent)',
      'accent-hover':  'var(--accent-hover)',
      'accent-text':   'var(--accent-text)',
      'accent-subtle': 'var(--accent-subtle)',
      danger:          'var(--danger)',
      'danger-subtle': 'var(--danger-subtle)',
      success:         'var(--success)',
      'success-subtle':'var(--success-subtle)',
    }
  }
}
```

Now in components:
```jsx
<div className="bg-surface border border-border rounded-xl">
  <h2 className="text-text-primary">Weakness Score</h2>
  <p className="text-text-muted">Updated just now</p>
  <button className="bg-accent text-accent-text">Start drill</button>
</div>
```

Works in both themes automatically. No `dark:` prefixes anywhere — the token swap handles everything.

---

## 4. THEME SWITCHING MECHANISM

### Store (Zustand)
```typescript
// stores/themeStore.ts
type Theme = 'dark' | 'light';

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}
// On set: update state, write data-theme attribute on <html>, persist to localStorage
```

### Applying the theme
```typescript
// The store writes to the DOM root:
document.documentElement.setAttribute('data-theme', theme);
```

Because all tokens are scoped to `[data-theme="..."]`, flipping this one attribute re-themes the entire app instantly — no re-render needed, CSS handles it.

### Persistence + first paint
- Theme saved to `localStorage` under `refyn-theme`
- Also synced to `profiles.theme_preference` in Supabase (so it follows the user across devices)
- **Prevent flash of wrong theme:** an inline script in `index.html` `<head>` reads localStorage and sets `data-theme` BEFORE React mounts:

```html
<script>
  (function() {
    var t = localStorage.getItem('refyn-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  })();
</script>
```

This runs before first paint — user never sees a dark→light flicker on load.

### Default
Dark is the default (matches the "performance dashboard" brand feel). Light is opt-in. New users start dark; their choice persists.

---

## 5. COMPONENT-LEVEL RULES

1. **Never** use a primitive color class (`text-zinc-400`, `bg-amber-500`) in a feature component
2. **Never** use arbitrary hex (`bg-[#111113]`)
3. **Never** use Tailwind's `dark:` variant — the token system replaces it entirely
4. Charts (Recharts) can't use CSS classes for data colors — read token values via `getComputedStyle` or pass theme-aware color props:

```typescript
// For Recharts, resolve tokens to actual values at render:
const styles = getComputedStyle(document.documentElement);
const accentColor = styles.getPropertyValue('--accent').trim();
// pass accentColor to <Radar fill={accentColor} />
```

5. Status colors (weak = danger, strong = success) use semantic tokens, so a weak topic is red in both themes but the *right* red for that theme's contrast

---

## 6. THEME-AWARE COMPONENT EXAMPLES

**Weakness card (works in both themes):**
```jsx
<div className="bg-surface border-l-[3px] border-danger rounded-xl p-4">
  <span className="text-danger text-xs font-medium">CRITICAL</span>
  <h3 className="text-text-primary font-semibold">Time, Speed & Distance</h3>
  <p className="text-text-muted text-sm">34% accuracy · 9/10 papers</p>
</div>
```

**Primary button:**
```jsx
<button className="bg-accent text-accent-text hover:bg-accent-hover
                   font-semibold rounded-lg h-11 px-4">
  Start Practice
</button>
```

**Section header (consistent everywhere):**
```jsx
<h4 className="text-text-muted text-xs font-semibold tracking-widest uppercase">
  Weak Topics
</h4>
```

---

## 7. TYPOGRAPHY TOKENS (theme-independent, but centralized)

Fonts don't change per theme, but centralize them as tokens too for consistency:

```css
:root {
  --font-display: 'Space Grotesk', system-ui, sans-serif;  /* headings, big numbers */
  --font-body:    'Inter', system-ui, sans-serif;          /* body, UI */
  --font-mono:    'JetBrains Mono', monospace;             /* timer, scores, formulas */
}
```

```js
// tailwind
fontFamily: {
  display: 'var(--font-display)',
  body:    'var(--font-body)',
  mono:    'var(--font-mono)',
}
```

Usage: `font-display`, `font-body`, `font-mono`. Load all three from Google Fonts with `font-display: swap`.

---

## 8. WHERE THE THEME TOGGLE LIVES

- **Profile screen** → Settings section → a clean dark/light toggle (sun/moon icon)
- Optionally a quick toggle in the desktop sidebar footer
- Not in the mobile bottom nav (precious space — keep it in Profile)

Toggle is a simple two-state switch, animates the icon (sun ↔ moon) via Framer Motion.

---

## 9. TESTING CHECKLIST (both themes)

Before any screen is "done," verify in BOTH dark and light:
- [ ] Text is readable (contrast ratio ≥ 4.5:1 for body, ≥ 3:1 for large text)
- [ ] Amber accent is visible and not washed out (that's why light uses amber-600)
- [ ] Danger/success colors are distinguishable
- [ ] Card borders are visible against the background
- [ ] Skeleton loaders match the surface
- [ ] Charts use resolved token colors, not hardcoded
- [ ] No flash of wrong theme on page load
- [ ] Modal overlays dim appropriately (darker backdrop in dark, lighter in light)

---

*Doc 3 of 4 — Theming. Next: Build Phases (ordered, shippable sequence).*
