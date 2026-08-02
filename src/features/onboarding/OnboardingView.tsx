import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { BrandMark, Button } from '@/components/ui';
import { motion } from 'framer-motion';

type Step = 'exam' | 'weak-areas' | 'daily-target';

export const OnboardingView = () => {
  const navigate = useNavigate();
  const { onboarding, updateOnboarding, completeOnboarding } = useAuthStore();
  const [step, setStep] = useState<Step>('exam');

  const handleNextStep = async () => {
    if (step === 'exam') {
      if (!onboarding.selectedExamId) return;
      setStep('weak-areas');
    } else if (step === 'weak-areas') {
      if (onboarding.weakAreas.length === 0) return;
      setStep('daily-target');
    } else if (step === 'daily-target') {
      if (!onboarding.dailyTarget) return;
      await completeOnboarding(); // persists to profiles + user_exams for real accounts
      navigate('/dashboard');
    }
  };

  const handlePrevStep = () => {
    if (step === 'weak-areas') setStep('exam');
    else if (step === 'daily-target') setStep('weak-areas');
  };

  const toggleWeakArea = (area: string) => {
    // Reads the live store instead of the render closure's `onboarding` — otherwise
    // consecutive toggles in the same batch (e.g. multi-select) each compute their
    // "updated" array from the same stale snapshot and the last call silently wins.
    const current = useAuthStore.getState().onboarding.weakAreas;
    const updated = current.includes(area)
      ? current.filter((a) => a !== area)
      : [...current, area];
    updateOnboarding({ weakAreas: updated });
  };

  const stepNumber = step === 'exam' ? 1 : step === 'weak-areas' ? 2 : 3;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="app-aurora" aria-hidden="true" />
      <div className="app-grid" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        key={step}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <BrandMark size={26} />
          <span className="font-display text-[0.9375rem] font-bold tracking-[-0.02em] text-text-primary">
            Refyn
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-body text-[0.8125rem] font-semibold text-text-primary">
              Step {stepNumber} of 3
            </span>
            <span className="font-body text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-text-muted">
              {step === 'exam' && 'Exam selection'}
              {step === 'weak-areas' && 'Weak areas'}
              {step === 'daily-target' && 'Daily target'}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <motion.div
              className="h-full rounded-full bg-gradient-accent"
              initial={false}
              animate={{ width: `${(stepNumber / 3) * 100}%` }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="space-y-6 rounded-2xl border border-border bg-surface-glass p-7 shadow-xl backdrop-blur-xl sm:p-8">
          {/* Step 1: Exam Selection */}
          {step === 'exam' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-text-primary mb-2">Which exam are you preparing for?</h2>
                <p className="text-text-muted text-sm">Choose your target exam to personalize your learning path.</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'cat', name: 'CAT 2025', desc: "IIM's flagship MBA entrance" },
                  { id: 'ssc', name: 'SSC CGL', desc: 'Staff Selection Commission (Coming soon)', disabled: true },
                  { id: 'gmat', name: 'GMAT', desc: 'Graduate Management Test (Coming soon)', disabled: true },
                ].map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => !exam.disabled && updateOnboarding({ selectedExamId: exam.id })}
                    disabled={exam.disabled}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      onboarding.selectedExamId === exam.id
                        ? 'bg-accent-subtle border-accent'
                        : exam.disabled
                        ? 'border-border opacity-50 cursor-not-allowed'
                        : 'border-border hover:border-accent'
                    }`}
                  >
                    <div className="font-semibold text-text-primary">{exam.name}</div>
                    <div className="text-xs text-text-muted mt-1">{exam.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Weak Areas */}
          {step === 'weak-areas' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-text-primary mb-2">What are your weak areas?</h2>
                <p className="text-text-muted text-sm">Pick at least 3 topics you want to improve.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  'Arithmetic',
                  'Algebra',
                  'Geometry',
                  'Modern Math',
                  'Time & Distance',
                  'Work & Time',
                  'Profit & Loss',
                  'Reasoning',
                ].map((area) => (
                  <button
                    key={area}
                    onClick={() => toggleWeakArea(area)}
                    className={`p-3 rounded-lg border-2 transition-all font-medium text-sm ${
                      onboarding.weakAreas.includes(area)
                        ? 'bg-accent-subtle border-accent text-accent'
                        : 'border-border text-text-secondary hover:border-accent'
                    }`}
                  >
                    {onboarding.weakAreas.includes(area) ? '✓ ' : ''}{area}
                  </button>
                ))}
              </div>

              <p className="text-xs text-text-muted pt-2">
                Selected: {onboarding.weakAreas.length} areas
              </p>
            </motion.div>
          )}

          {/* Step 3: Daily Target */}
          {step === 'daily-target' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-text-primary mb-2">How many questions per day?</h2>
                <p className="text-text-muted text-sm">Set your daily practice goal.</p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => updateOnboarding({ dailyTarget: Math.max(5, (onboarding.dailyTarget || 20) - 5) })}
                  className="w-12 h-12 rounded-lg bg-surface-raised border border-border hover:border-accent transition-colors"
                >
                  −
                </button>
                <div className="text-center">
                  <div className="text-4xl font-bold text-accent">{onboarding.dailyTarget || 20}</div>
                  <div className="text-xs text-text-muted mt-1">questions/day</div>
                </div>
                <button
                  onClick={() => updateOnboarding({ dailyTarget: (onboarding.dailyTarget || 20) + 5 })}
                  className="w-12 h-12 rounded-lg bg-surface-raised border border-border hover:border-accent transition-colors"
                >
                  +
                </button>
              </div>

              <div className="bg-accent-subtle rounded-lg p-4 text-sm">
                <p className="text-text-muted">
                  ≈ <span className="font-semibold text-accent">{Math.round((onboarding.dailyTarget || 20) * 2.5)} minutes</span> per day
                </p>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              fullWidth
              onClick={handlePrevStep}
              disabled={step === 'exam'}
            >
              Back
            </Button>
            <Button
              fullWidth
              onClick={handleNextStep}
              disabled={
                (step === 'exam' && !onboarding.selectedExamId) ||
                (step === 'weak-areas' && onboarding.weakAreas.length === 0) ||
                (step === 'daily-target' && !onboarding.dailyTarget)
              }
            >
              {step === 'daily-target' ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
