import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';
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
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-8"
        >
          <div className="text-5xl font-display font-bold bg-gradient-to-r from-accent to-amber-400 bg-clip-text text-transparent mb-2">
            REFYN
          </div>
          <p className="text-text-secondary">Hunt your weakness. Own the exam.</p>
        </motion.div>

        {/* Card */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-surface rounded-lg p-8 shadow-lg space-y-6"
        >
          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-text-muted text-sm">
              {isSignup
                ? 'Sign up to start hunting your weak spots'
                : 'Sign in to continue your learning journey'}
            </p>
          </div>

          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || !isSupabaseConfigured}
            label="Email"
          />

          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || !isSupabaseConfigured}
            label="Password"
          />

          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="lg"
            disabled={!isSupabaseConfigured || !email.trim() || !password.trim()}
          >
            {isSignup ? 'Create Account' : 'Sign In'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setPassword('');
            }}
            className="w-full text-sm text-accent hover:text-accent-hover transition-colors"
          >
            {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>

          {!isSupabaseConfigured && (
            <p className="text-xs text-danger text-center">
              Supabase keys missing — real sign-in is disabled in this build.
            </p>
          )}
        </motion.form>

        {/* Explore without auth (demo mode) */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          type="button"
          onClick={handleSkip}
          className="w-full mt-4 py-2 text-sm text-text-muted hover:text-accent transition-colors"
        >
          Skip for now — explore the app →
        </motion.button>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6 text-xs text-text-muted"
        >
          <p>Demo mode keeps everything on this device. Sign in to sync for real.</p>
        </motion.div>
      </motion.div>
    </div>
  );
};
