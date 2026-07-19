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
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const sendMagicLink = useAuthStore((state) => state.sendMagicLink);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const skipAuth = useAuthStore((state) => state.skipAuth);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await sendMagicLink(email.trim());
      setOtpSent(true);
      toast.success('Code sent to your email!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(email.trim(), otp.trim());
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
        {otpSent ? (
          <motion.form
            onSubmit={handleVerifyOtp}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface rounded-lg p-8 shadow-lg space-y-6"
          >
            <div>
              <h2 className="text-2xl font-semibold text-text-primary mb-2">Enter verification code</h2>
              <p className="text-text-muted text-sm">
                We sent a 6-digit code to <span className="font-medium">{email}</span>. Check your inbox (and spam folder).
              </p>
            </div>

            <Input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={loading}
              label="Verification Code"
              maxLength={6}
            />

            <Button type="submit" fullWidth loading={loading} size="lg" disabled={otp.length !== 6}>
              Verify & Sign In
            </Button>

            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtp('');
              }}
              className="w-full text-sm text-accent hover:text-accent-hover transition-colors"
            >
              Use a different email
            </button>
          </motion.form>
        ) : (
          <motion.form
            onSubmit={handleSendOtp}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-surface rounded-lg p-8 shadow-lg space-y-6"
          >
            <div>
              <h2 className="text-2xl font-semibold text-text-primary mb-2">Welcome</h2>
              <p className="text-text-muted text-sm">
                Enter your email — we'll send you a one-time code. No password needed.
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

            <Button
              type="submit"
              fullWidth
              loading={loading}
              size="lg"
              disabled={!isSupabaseConfigured || !email.trim()}
            >
              Send Verification Code
            </Button>

            {!isSupabaseConfigured && (
              <p className="text-xs text-danger text-center">
                Supabase keys missing — real sign-in is disabled in this build.
              </p>
            )}
          </motion.form>
        )}

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
