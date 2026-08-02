/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-sunken': 'var(--bg-sunken)',
        surface: 'var(--surface)',
        'surface-raised': 'var(--surface-raised)',
        'surface-overlay': 'var(--surface-overlay)',
        'surface-glass': 'var(--surface-glass)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-highlight': 'var(--border-highlight)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'text-faint': 'var(--text-faint)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-active': 'var(--accent-active)',
        'accent-text': 'var(--accent-text)',
        'accent-subtle': 'var(--accent-subtle)',
        'accent-muted': 'var(--accent-muted)',
        'accent-2': 'var(--accent-2)',
        'accent-2-subtle': 'var(--accent-2-subtle)',
        danger: 'var(--danger)',
        'danger-hover': 'var(--danger-hover)',
        'danger-subtle': 'var(--danger-subtle)',
        success: 'var(--success)',
        'success-subtle': 'var(--success-subtle)',
        // `warning` was used by ProfileView but never defined here, so every
        // bg-warning / text-warning class in the app silently rendered nothing.
        warning: 'var(--warning)',
        'warning-subtle': 'var(--warning-subtle)',
        info: 'var(--info)',
        'info-subtle': 'var(--info-subtle)',
        skeleton: 'var(--skeleton)',
        overlay: 'var(--overlay)',
        'topic-a': 'var(--topic-a)',
        'topic-b': 'var(--topic-b)',
        'topic-c': 'var(--topic-c)',
        'topic-d': 'var(--topic-d)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        glow: 'var(--glow-accent)',
        'glow-soft': 'var(--glow-accent-soft)',
      },
      backgroundImage: {
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-accent-soft': 'var(--gradient-accent-soft)',
        'gradient-sheen': 'var(--gradient-sheen)',
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out-expo)',
        spring: 'var(--ease-spring)',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
        // Shell metrics, referenced by both the sidebar and the content offset
        // so the two can never drift apart.
        sidebar: '15rem',
        topbar: '3.75rem',
      },
      maxWidth: {
        content: '1560px',
        prose: '68ch',
      },
      screens: {
        // The app previously stopped adapting at `lg`. This is where the
        // desktop grid gains its final column.
        '3xl': '1800px',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise 380ms var(--ease-out-expo) both',
      },
    },
  },
  plugins: [],
}
