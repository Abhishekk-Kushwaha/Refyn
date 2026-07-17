import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui';
import { motion } from 'framer-motion';

export const App = () => {
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center justify-center min-h-screen px-4"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 20 }}
          className="text-6xl font-display font-bold mb-2 bg-gradient-to-r from-accent to-amber-400 bg-clip-text text-transparent"
        >
          REFYN
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xl text-text-secondary mb-8 text-center font-light"
        >
          Hunt your weakness. Own the exam.
        </motion.p>

        {/* Status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-8 text-center"
        >
          <div className="bg-accent-subtle rounded-full px-4 py-2 text-accent text-sm font-semibold inline-block">
            🏗️ Phase 0: Foundation
          </div>
        </motion.div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-md text-center mb-12"
        >
          <p className="text-text-secondary mb-6">
            A premium exam prep PWA with an AI-powered weakness detection engine. Built mobile-first, designed for scale.
          </p>

          {/* Feature Grid */}
          <div className="grid grid-cols-3 gap-2 mb-8">
            {['⚡ Fast', '🎯 Smart', '♿ Accessible'].map((feature, i) => (
              <motion.div
                key={feature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="text-xs text-text-muted"
              >
                {feature}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex gap-3 flex-col sm:flex-row"
        >
          <Button size="lg">
            Get Started
          </Button>
          <Button size="lg" variant="secondary">
            Learn More
          </Button>
        </motion.div>

        {/* Theme Toggle (Bottom Right) */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={toggleTheme}
          className="fixed bottom-4 right-4 p-2 rounded-full bg-surface-raised hover:bg-surface border border-border transition-all"
          title="Toggle theme"
        >
          <span className="text-xl">
            {theme === 'dark' ? '☀️' : '🌙'}
          </span>
        </motion.button>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="fixed bottom-4 left-4 text-xs text-text-muted"
        >
          <p>Current Theme: <span className="font-semibold text-accent">{theme}</span></p>
        </motion.div>
      </motion.div>
    </div>
  );
};
