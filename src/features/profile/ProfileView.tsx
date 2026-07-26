import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aweEngine } from '@/engine/engine';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useWeaknessScores } from '@/hooks/useWeaknessScores';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Display } from '@/components/ui';
import { useToast } from '@/components/feedback';
import { motion } from 'framer-motion';

export const ProfileView = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const isDemo = useAuthStore((state) => state.isDemo);
  const { theme, setTheme } = useThemeStore();
  const { data: weaknessData, isLoading } = useWeaknessScores();

  // yyyy-mm-dd for the native date input; the engine stores a full ISO string.
  const [examDate, setExamDate] = useState<string | null>(
    () => aweEngine.getExamDate()?.slice(0, 10) ?? null
  );
  const daysToExam = aweEngine.daysToExam();

  const handleExamDateChange = (value: string) => {
    const next = value ? new Date(`${value}T00:00:00`).toISOString() : null;
    aweEngine.setExamDate(next);
    setExamDate(value || null);
    toast.success(value ? 'Exam date saved' : 'Exam date cleared');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Signed out successfully');
    } catch (err) {
      toast.error('Failed to sign out');
    }
  };

  const overallAccuracy =
    weaknessData && weaknessData.totalAttempts > 0
      ? Math.round(
          (weaknessData.subtopics.reduce((sum, s) => sum + s.correct, 0) /
            weaknessData.totalAttempts) *
            100
        )
      : 0;

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Display as="h1" size="md">
          Profile
        </Display>
        <p className="mt-2 font-body text-sm text-text-secondary">
          Your stats, settings, and account info
        </p>
      </motion.div>

      {/* Account Info */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Account Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-text-muted mb-1">Name</p>
              <p className="text-text-primary font-medium">{session?.user.displayName || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-text-muted mb-1">Email</p>
              <p className="text-text-primary font-medium">{session?.user.email || 'Not available'}</p>
            </div>
            {isDemo && (
              <div className="bg-warning/10 border border-warning/30 rounded p-3">
                <p className="text-sm text-warning">
                  You're in demo mode. Sign in to sync your progress across devices.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Your Stats</CardTitle>
            <CardDescription>Based on your practice sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-10 bg-surface-raised rounded animate-pulse" />
                <div className="h-10 bg-surface-raised rounded animate-pulse" />
              </div>
            ) : weaknessData && weaknessData.totalAttempts > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-raised rounded p-4">
                  <p className="text-sm text-text-muted mb-2">Total Attempts</p>
                  <p className="text-2xl font-semibold text-accent">
                    {weaknessData.totalAttempts}
                  </p>
                </div>
                <div className="bg-surface-raised rounded p-4">
                  <p className="text-sm text-text-muted mb-2">Accuracy</p>
                  <p className="text-2xl font-semibold text-success">{overallAccuracy}%</p>
                </div>
                <div className="bg-surface-raised rounded p-4">
                  <p className="text-sm text-text-muted mb-2">Topics</p>
                  <p className="text-2xl font-semibold text-text-primary">
                    {weaknessData.topics.length}
                  </p>
                </div>
                <div className="bg-surface-raised rounded p-4">
                  <p className="text-sm text-text-muted mb-2">Concepts</p>
                  <p className="text-2xl font-semibold text-text-primary">
                    {weaknessData.subtopics.length}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-text-muted mb-4">Complete a practice session to see your stats here</p>
                <Button onClick={() => navigate('/practice')} size="sm">
                  Start Practicing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Settings */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Exam date — this is what opens the pre-CAT revival window (R009).
                Without it the engine records `everWasVeryWeak` forever and can
                never act on it, because daysToExam is always null. */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-text-primary font-medium">Exam date</p>
                <p className="text-sm text-text-muted">
                  {examDate
                    ? daysToExam !== null && daysToExam >= 0
                      ? `${daysToExam} days to go — old weak spots revive in the last 30`
                      : 'Date has passed'
                    : 'Set it to revive old weak spots before the exam'}
                </p>
              </div>
              <input
                type="date"
                value={examDate ?? ''}
                onChange={(e) => handleExamDateChange(e.target.value)}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                aria-label="Exam date"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-primary font-medium">Theme</p>
                <p className="text-sm text-text-muted">Dark mode</p>
              </div>
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card borderColor="danger">
          <CardHeader>
            <CardTitle>Sign Out</CardTitle>
            <CardDescription>End your session</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLogout} variant="danger" fullWidth>
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
