import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aweEngine } from '@/engine/engine';
import { useAuthStore } from '@/stores/authStore';
import { THEME_LABELS, THEME_ORDER, useThemeStore } from '@/stores/themeStore';
import { useWeaknessScores } from '@/hooks/useWeaknessScores';
import { Button, Icon, Panel, PanelHeader, StatCard } from '@/components/ui';
import { Page, PageHeader, PageGrid } from '@/components/layout';
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

  const displayName = session?.user.displayName || session?.user.email?.split('@')[0] || 'Student';
  const hasStats = weaknessData && weaknessData.totalAttempts > 0;

  return (
    <Page width="default">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Your stats, exam timeline, and app settings."
      />

      {/* ---- Identity card ------------------------------------------- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mb-5"
      >
        <Panel elevation="md" className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-accent-soft"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-accent font-display text-2xl font-bold text-accent-text shadow-glow-soft">
              {displayName.charAt(0).toUpperCase()}
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-xl font-bold tracking-[-0.025em] text-text-primary">
                {displayName}
              </h2>
              <p className="mt-0.5 truncate font-body text-sm text-text-muted">
                {session?.user.email || 'No email on file'}
              </p>

              {isDemo && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning-subtle px-2.5 py-1 font-body text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-warning">
                  <Icon name="alert" size={11} />
                  Demo mode — progress stays on this device
                </span>
              )}
            </div>

            <Button variant="secondary" icon="logout" onClick={handleLogout} className="sm:ml-auto">
              Sign out
            </Button>
          </div>
        </Panel>
      </motion.div>

      {/* ---- Stats ---------------------------------------------------- */}
      {isLoading ? (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
      ) : hasStats ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5"
        >
          <StatCard
            label="Attempted"
            value={weaknessData.totalAttempts}
            icon="practice"
            tone="accent"
          />
          <StatCard
            label="Accuracy"
            value={overallAccuracy}
            unit="%"
            icon="trend"
            tone={overallAccuracy >= 70 ? 'success' : 'default'}
          />
          <StatCard label="Sections" value={weaknessData.topics.length} icon="layers" />
          <StatCard label="Concepts" value={weaknessData.subtopics.length} icon="spark" />
        </motion.div>
      ) : (
        <Panel className="mb-5 text-center">
          <p className="mb-4 font-body text-sm text-text-muted">
            Complete a practice session to see your stats here.
          </p>
          <Button onClick={() => navigate('/practice')}>Start practising</Button>
        </Panel>
      )}

      {/* ---- Settings -------------------------------------------------- */}
      <PageGrid className="items-start">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="lg:col-span-6"
        >
          <Panel className="h-full">
            <PanelHeader icon="calendar" title="Exam timeline" />

            {/* Exam date — this is what opens the pre-CAT revival window (R009).
                Without it the engine records `everWasVeryWeak` forever and can
                never act on it, because daysToExam is always null. */}
            <div className="flex flex-col gap-3">
              <label
                htmlFor="exam-date"
                className="font-body text-sm font-semibold text-text-primary"
              >
                Exam date
              </label>
              <input
                id="exam-date"
                type="date"
                value={examDate ?? ''}
                onChange={(e) => handleExamDateChange(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-raised px-3.5 py-2.5 font-body text-sm text-text-primary transition-colors hover:border-border-strong focus-visible:border-accent"
              />
              <p className="font-body text-xs leading-relaxed text-text-muted">
                {examDate
                  ? daysToExam !== null && daysToExam >= 0
                    ? `${daysToExam} days to go — old weak spots revive in the final 30.`
                    : 'That date has passed. Set a new one to re-arm the revival window.'
                  : 'Set it and the engine revives previously weak concepts in the last 30 days before your exam.'}
              </p>
            </div>

            {examDate && daysToExam !== null && daysToExam >= 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-body text-[0.8125rem] text-text-muted">Days remaining</span>
                  <span className="font-display text-2xl font-bold tabular-nums text-accent">
                    {daysToExam}
                  </span>
                </div>
              </div>
            )}
          </Panel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          className="lg:col-span-6"
        >
          <Panel className="h-full">
            <PanelHeader icon="settings" title="Preferences" />

            {/* A segmented picker, not a switch. There are three themes now,
                and a two-state toggle cannot say which of them is on. */}
            <div className="rounded-lg border border-border bg-surface-raised p-4">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-text-muted">
                  <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} />
                </span>
                <span>
                  <span className="block font-body text-sm font-semibold text-text-primary">
                    Appearance
                  </span>
                  <span className="block font-body text-xs text-text-muted">
                    {THEME_LABELS[theme]} theme
                  </span>
                </span>
              </div>

              <div
                role="radiogroup"
                aria-label="Theme"
                className="flex gap-1 rounded-lg border border-border bg-surface p-1"
              >
                {THEME_ORDER.map((option) => (
                  <button
                    key={option}
                    role="radio"
                    aria-checked={theme === option}
                    onClick={() => setTheme(option)}
                    className={`flex-1 rounded-md px-3 py-2 font-body text-xs font-semibold transition-colors ${
                      theme === option
                        ? 'bg-gradient-accent text-accent-text shadow-glow-soft'
                        : 'text-text-muted hover:bg-surface-raised hover:text-text-primary'
                    }`}
                  >
                    {THEME_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-3 font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Session
              </p>
              <Button variant="danger" icon="logout" fullWidth onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </Panel>
        </motion.div>
      </PageGrid>
    </Page>
  );
};
