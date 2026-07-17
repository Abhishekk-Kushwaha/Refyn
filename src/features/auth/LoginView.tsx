import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input } from '@/components/ui';
import { motion } from 'framer-motion';

export const LoginView = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await login(email);
      navigate('/onboarding');
    } finally {
      setLoading(false);
    }
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
          onSubmit={handleLogin}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-surface rounded-lg p-8 shadow-lg space-y-6"
        >
          <div>
            <h2 className="text-2xl font-semibold text-text-primary mb-2">Welcome Back</h2>
            <p className="text-text-muted text-sm">Sign in to continue to your dashboard</p>
          </div>

          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            label="Email"
          />

          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="lg"
          >
            Continue with Email
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-surface text-text-muted">Or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            size="lg"
            disabled={loading}
          >
            🔵 Sign in with Google
          </Button>

          <p className="text-center text-xs text-text-muted">
            No account? <span className="text-accent cursor-pointer hover:text-accent-hover">Sign up</span>
          </p>
        </motion.form>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-8 text-xs text-text-muted space-y-1"
        >
          <p>🚀 Phase 0 Foundation Complete</p>
          <p>Phase 2: Onboarding + Navigation</p>
        </motion.div>
      </motion.div>
    </div>
  );
};
