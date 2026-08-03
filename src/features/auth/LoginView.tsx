import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { BrandMark, Button, Icon, Input } from '@/components/ui';
import { useToast } from '@/components/feedback';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { motion } from 'framer-motion';

export const LoginView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const skipAuth = useAuthStore((state) => state.skipAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    try {
      if (isSignup) {
        await signup(email.trim(), password.trim());
        toast.success('Account created! Signing in...');
      } else {
        await login(email.trim(), password.trim());
        toast.success('Signed in successfully!');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    skipAuth();
    navigate('/dashboard');
  };

  return (
    <div className="relative min-h-screen bg-bg lg:grid lg:grid-cols-[1.1fr_1fr]">
      <div className="app-aurora" aria-hidden="true" />
      <div className="app-grid" aria-hidden="true" />

      {/* ---- Brand panel (desktop only) ------------------------------- */}
      <aside className="relative z-10 hidden flex-col justify-between border-r border-border p-12 lg:flex xl:p-16">
        <div className="flex items-center gap-3">
          <BrandMark size={34} />
          <span className="font-display text-lg font-bold tracking-[-0.02em] text-text-primary">
            Refyn
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl"
        >
          <h1 className="font-display text-[3.25rem] font-bold leading-[1.02] tracking-[-0.04em] text-text-primary xl:text-[3.75rem]">
            Hunt your weakness.
            <br />
            <span className="text-gradient">Own the exam.</span>
          </h1>

          <p className="mt-6 max-w-lg font-body text-base leading-relaxed text-text-secondary">
            Refyn ranks every concept you touch by how badly it is costing you marks, then keeps
            feeding you the ones that matter. No streak theatre — just an engine that knows where
            you are losing.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              {
                title: 'Adaptive weakness engine',
                body: 'Every attempt re-ranks your profile in real time.',
              },
              {
                title: 'Pacing that gets measured',
                body: 'Time spent on wrong answers is tracked separately from right ones.',
              },
              {
                title: 'Spaced repetition, automatic',
                body: 'Cards queue themselves the moment a concept starts slipping.',
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-subtle text-accent">
                  <Icon name="check" size={12} strokeWidth={3} />
                </span>
                <span>
                  <span className="block font-body text-sm font-semibold text-text-primary">
                    {item.title}
                  </span>
                  <span className="block font-body text-[0.8125rem] text-text-muted">
                    {item.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        <p className="font-body text-xs text-text-faint">
          Built for CAT quant. Works offline in demo mode.
        </p>
      </aside>

      {/* ---- Form panel ----------------------------------------------- */}
      <div className="relative z-10 flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        {/* The instrument, watermarked. The dashboard's radar is the thing
            this product actually is, so it stands behind the door to it. */}
        <svg
          viewBox="0 0 280 280"
          className="pointer-events-none absolute -top-10 left-1/2 h-[360px] w-[360px] -translate-x-1/2 opacity-[0.14]"
          aria-hidden="true"
        >
          <g stroke="var(--accent-hover)" fill="none" strokeWidth="1">
            <polygon points="140,65 205,102.5 205,177.5 140,215 75,177.5 75,102.5" />
            <polygon points="140,90 183.3,115 183.3,165 140,190 96.7,165 96.7,115" />
            <polygon points="140,115 161.7,127.5 161.7,152.5 140,165 118.3,152.5 118.3,127.5" />
          </g>
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[420px]"
        >
          {/* Mobile brand — the desktop panel already carries this. */}
          <div className="mb-7 flex flex-col items-center text-center lg:hidden">
            {/* Lit, not flat: the mark sits over the aurora, and the glow is
                what stops it reading as a sticker on the background. */}
            <span className="mb-4 inline-flex rounded-[20px] shadow-glow">
              <BrandMark size={64} />
            </span>
            <h1 className="font-display text-[1.875rem] font-bold tracking-[-0.03em] text-text-primary">
              Refyn
            </h1>
            <p className="mt-1 font-body text-[0.84375rem] text-text-secondary">
              Hunt your weakness. Own the exam.
            </p>
          </div>

          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08 }}
            className="space-y-5 rounded-2xl border border-border bg-surface-glass p-7 shadow-xl backdrop-blur-xl sm:p-8"
          >
            <div>
              <h2 className="font-display text-[1.625rem] font-bold tracking-[-0.03em] text-text-primary">
                {isSignup ? 'Create account' : 'Welcome back'}
              </h2>
              <p className="mt-1.5 font-body text-sm text-text-muted">
                {isSignup
                  ? 'Sign up to start hunting your weak spots.'
                  : 'Sign in to pick up where the engine left off.'}
              </p>
            </div>

            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || !isSupabaseConfigured}
              label="Email"
              autoComplete="email"
            />

            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || !isSupabaseConfigured}
              label="Password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />

            <Button
              type="submit"
              fullWidth
              loading={loading}
              size="lg"
              disabled={!isSupabaseConfigured || !email.trim() || !password.trim()}
            >
              {isSignup ? 'Create account' : 'Sign in'}
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setPassword('');
              }}
              className="w-full font-body text-[0.8125rem] text-text-muted transition-colors hover:text-accent"
            >
              {isSignup ? (
                <>
                  Already have an account? <span className="font-semibold text-accent">Sign in</span>
                </>
              ) : (
                <>
                  Don&rsquo;t have an account?{' '}
                  <span className="font-semibold text-accent">Sign up</span>
                </>
              )}
            </button>

            {!isSupabaseConfigured && (
              <p className="rounded-lg border border-danger/25 bg-danger-subtle px-3 py-2 text-center font-body text-xs text-danger">
                Supabase keys missing — real sign-in is disabled in this build.
              </p>
            )}
          </motion.form>

          {/* Explore without auth (demo mode) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mt-6 text-center"
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-faint">
                or
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="secondary"
              size="lg"
              fullWidth
              trailingIcon="arrowRight"
              onClick={handleSkip}
            >
              Explore in demo mode
            </Button>

            <p className="mt-4 font-body text-xs leading-relaxed text-text-faint">
              Demo mode keeps everything on this device. Sign in to sync for real.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
