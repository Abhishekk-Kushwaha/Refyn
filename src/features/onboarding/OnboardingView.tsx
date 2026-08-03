import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { BrandMark, Button, Icon } from '@/components/ui';
import { motion } from 'framer-motion';
import clsx from 'clsx';

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
          {/* One segment per step. A continuous bar at 33% tells you how far
              in you are; three segments tell you how much is left. */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={clsx(
                  'h-[5px] flex-1 rounded-full transition-colors duration-300',
                  n <= stepNumber ? 'bg-gradient-accent' : 'bg-surface-overlay'
                )}
              />
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="space-y-6 rounded-2xl border border-border bg-surface-glass p-7 shadow-xl backdrop-blur-xl sm:p-8">
          {/* Step 1: Exam Selection */}
          {step === 'exam' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div>
                <h2 className="mb-2 font-display text-2xl font-bold leading-[1.15] tracking-[-0.025em] text-text-primary">
                  Which exam are you preparing for?
                </h2>
                <p className="font-body text-[0.84375rem] leading-relaxed text-text-secondary">
                  We tune every drill, card and weakness signal to it.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { id: 'cat', badge: 'CAT', name: 'CAT 2025', desc: "IIM's flagship MBA entrance" },
                  { id: 'ssc', badge: 'SSC', name: 'SSC CGL', desc: 'Staff Selection Commission', disabled: true },
                  { id: 'gmat', badge: 'GMAT', name: 'GMAT', desc: 'Graduate Management Test', disabled: true },
                ].map((exam) => {
                  const selected = onboarding.selectedExamId === exam.id;
                  return (
                    <button
                      key={exam.id}
                      onClick={() => !exam.disabled && updateOnboarding({ selectedExamId: exam.id })}
                      disabled={exam.disabled}
                      aria-pressed={selected}
                      className={clsx(
                        'flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] p-4 text-left',
                        'transition-[border-color,background,box-shadow,transform] duration-150 ease-out-expo',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                        selected
                          ? 'border-accent bg-accent-subtle shadow-glow-soft'
                          : exam.disabled
                          ? 'cursor-not-allowed border-border bg-surface opacity-55'
                          : 'border-border bg-surface hover:border-border-strong active:scale-[0.99]'
                      )}
                    >
                      <span
                        className={clsx(
                          'grid h-[46px] w-[46px] shrink-0 place-items-center rounded-xl font-display font-bold',
                          exam.badge.length > 3 ? 'text-xs' : 'text-[0.9375rem]',
                          selected
                            ? 'bg-gradient-accent text-white shadow-glow-soft'
                            : 'bg-surface-overlay text-text-muted'
                        )}
                      >
                        {exam.badge}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-heading text-base font-semibold text-text-primary">
                          {exam.name}
                        </span>
                        <span className="mt-0.5 block font-body text-xs text-text-muted">
                          {exam.desc}
                        </span>
                      </span>

                      {selected && (
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-white">
                          <Icon name="check" size={14} strokeWidth={3} />
                        </span>
                      )}
                      {exam.disabled && (
                        <span className="shrink-0 rounded-full bg-surface-overlay px-2.5 py-1 font-body text-[0.5625rem] font-bold uppercase tracking-[0.08em] text-text-muted">
                          Soon
                        </span>
                      )}
                    </button>
                  );
                })}
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
          {/* Back stays compact — it's the escape hatch, not the action. */}
          <div className="flex gap-2.5 pt-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={handlePrevStep}
              disabled={step === 'exam'}
            >
              Back
            </Button>
            <Button
              size="lg"
              className="flex-1"
              trailingIcon={step === 'daily-target' ? undefined : 'arrowRight'}
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
