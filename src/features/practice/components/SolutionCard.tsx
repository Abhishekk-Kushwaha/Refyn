import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { MockQuestion } from '@/lib/mockQuestions';
import { AnswerRecord } from '@/stores/sessionStore';
import { getErrorMessage } from '@/lib/errors';
import { Icon, MathText } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import {
  AI_SIGN_IN_MESSAGE,
  buildExplainRequest,
  explainQuestion,
  isAiExplainerConfigured,
} from '@/services/ai.service';

interface SolutionCardProps {
  question: MockQuestion;
  answer?: AnswerRecord;
  index: number;
}

const optionKeys = ['a', 'b', 'c', 'd'] as const;

/** Sparkle — marks anything AI-generated across the app. */
const SparkleIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={clsx('h-4 w-4', className)}
  >
    <path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
    <path d="M18.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" opacity="0.7" />
    <path d="M5 15l.7 2 2 .7-2 .7L5 20.4l-.7-2-2-.7 2-.7L5 15z" opacity="0.5" />
  </svg>
);

/**
 * Splits the model's plain-text answer into renderable blocks.
 *
 * The endpoint promises "plain text with simple line breaks" and nothing more,
 * so the numbered treatment is applied only when the model actually numbered
 * its own steps. Inventing the structure — drawing step circles around
 * arbitrary line breaks — would dress up prose as reasoning it never claimed.
 */
interface Block {
  n: string | null;
  text: string;
}

const LEADING_NUMBER = /^(?:step\s*)?(\d{1,2})\s*[.):-]\s+/i;

const parseBlocks = (explanation: string): Block[] =>
  explanation
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = LEADING_NUMBER.exec(line);
      return match
        ? { n: match[1], text: line.slice(match[0].length) }
        : { n: null, text: line };
    });

export const SolutionCard = ({ question, answer, index }: SolutionCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const session = useAuthStore((state) => state.session);
  const isDemo = useAuthStore((state) => state.isDemo);

  const skipped = !answer || answer.skipped || answer.selectedAnswer === null;
  const isCorrect = !skipped && answer.isCorrect;
  const status = skipped ? 'skipped' : isCorrect ? 'correct' : 'wrong';
  const aiReady = isAiExplainerConfigured();
  // Demo explorers have no Supabase token, so the endpoint can only refuse
  // them. Say so on the button instead of letting them press it and fail.
  const canUseAi = Boolean(session) && !isDemo;

  const statusLabel = { correct: 'Correct', wrong: 'Wrong', skipped: 'Skipped' }[status];
  const statusClass = {
    correct: 'bg-success-subtle text-success',
    wrong: 'bg-danger-subtle text-danger',
    skipped: 'bg-surface-raised text-text-muted',
  }[status];
  const edgeClass = {
    correct: 'border-l-success',
    wrong: 'border-l-danger',
    skipped: 'border-l-border-strong',
  }[status];

  const handleExplain = async () => {
    setAiError(null);
    setIsLoadingAi(true);
    try {
      const result = await explainQuestion(
        buildExplainRequest(question, answer?.selectedAnswer ?? null, isCorrect)
      );
      setExplanation(result.explanation);
    } catch (e) {
      setAiError(getErrorMessage(e));
    } finally {
      setIsLoadingAi(false);
    }
  };

  const blocks = explanation ? parseBlocks(explanation) : [];

  return (
    <div
      className={clsx(
        'overflow-hidden rounded-xl border border-l-[3px] border-border bg-surface',
        edgeClass
      )}
    >
      {/* Header — always visible, toggles the solution */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-surface-raised"
      >
        <span className="mt-px shrink-0 font-mono text-[0.6875rem] font-bold tabular-nums text-text-faint">
          Q{index + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={clsx(
              'block font-body text-[0.8125rem] leading-snug text-text-primary',
              !isOpen && 'truncate'
            )}
          >
            <MathText>{question.questionText}</MathText>
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 font-body text-[0.59375rem] font-bold uppercase tracking-[0.06em]',
                statusClass
              )}
            >
              {statusLabel}
            </span>
            <span className="truncate font-body text-[0.625rem] text-text-muted">
              {question.subtopicName}
            </span>
          </span>
        </span>

        <Icon
          name="chevronDown"
          size={16}
          strokeWidth={2.2}
          className={clsx(
            'mt-px shrink-0 text-text-muted transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-3.5 pb-4 pt-4">
              {/* Full question text (the header truncates it) */}
              <p className="mb-4 font-body text-[0.96875rem] leading-[1.5] text-text-primary">
                <MathText>{question.questionText}</MathText>
              </p>

              {/* MCQ options with correct / chosen markers */}
              {question.questionType === 'mcq' && question.options && (
                <div className="mb-4 flex flex-col gap-2">
                  {optionKeys.map((key) => {
                    const isRight = question.correctAnswer.trim().toLowerCase() === key;
                    const isChosen = answer?.selectedAnswer === key;
                    return (
                      <div
                        key={key}
                        className={clsx(
                          'flex items-center gap-2.5 rounded-xl border p-3',
                          isRight
                            ? 'border-success bg-success-subtle'
                            : isChosen
                            ? 'border-danger bg-danger-subtle'
                            : 'border-border'
                        )}
                      >
                        <span
                          className={clsx(
                            'grid h-5 w-5 shrink-0 place-items-center rounded-full font-body text-[0.625rem] font-bold uppercase',
                            isRight
                              ? 'bg-success text-white'
                              : isChosen
                              ? 'bg-danger text-white'
                              : 'border border-border-strong text-text-muted'
                          )}
                        >
                          {isRight ? (
                            <Icon name="check" size={12} strokeWidth={3} />
                          ) : isChosen ? (
                            <Icon name="close" size={11} strokeWidth={3} />
                          ) : (
                            key
                          )}
                        </span>

                        <span
                          className={clsx(
                            'min-w-0 flex-1 font-body text-[0.84375rem]',
                            isRight || isChosen
                              ? 'font-medium text-text-primary'
                              : 'text-text-muted'
                          )}
                        >
                          <MathText>{question.options![key]}</MathText>
                        </span>

                        {isRight && (
                          <span className="shrink-0 font-body text-[0.625rem] font-bold uppercase tracking-[0.06em] text-success">
                            Correct
                          </span>
                        )}
                        {isChosen && !isRight && (
                          <span className="shrink-0 font-body text-[0.625rem] font-bold uppercase tracking-[0.06em] text-danger">
                            Your answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TITA — no options to mark up, so show the two values side by side */}
              {question.questionType === 'tita' && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-surface-raised p-3">
                    <div className="mb-1 font-body text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Your answer
                    </div>
                    <div
                      className={clsx(
                        'font-mono text-sm font-semibold',
                        isCorrect ? 'text-success' : 'text-danger'
                      )}
                    >
                      {answer?.selectedAnswer ?? '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface-raised p-3">
                    <div className="mb-1 font-body text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      Correct answer
                    </div>
                    <div className="font-mono text-sm font-semibold text-success">
                      {question.correctAnswer}
                    </div>
                  </div>
                </div>
              )}

              {/* Authored solution */}
              <div className="mb-3.5 rounded-xl border border-border bg-surface-raised p-3.5">
                <div className="mb-1.5 font-body text-[0.59375rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                  Solution
                </div>
                <p className="whitespace-pre-line font-body text-[0.8125rem] leading-[1.6] text-text-secondary">
                  <MathText>
                    {question.solution ||
                      'A written solution has not been added for this question yet.'}
                  </MathText>
                </p>
              </div>

              {/* AI explanation — button is live now, the model plugs in behind ai.service */}
              {!explanation && (
                <button
                  onClick={handleExplain}
                  disabled={isLoadingAi || !canUseAi}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-xl border border-accent-muted bg-accent-subtle p-3',
                    'font-body text-[0.8125rem] font-semibold text-accent transition-colors hover:border-accent',
                    'disabled:cursor-not-allowed disabled:opacity-60'
                  )}
                >
                  {isLoadingAi ? (
                    <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <SparkleIcon className="shrink-0" />
                  )}
                  <span className="flex-1 text-left">
                    {!canUseAi
                      ? 'Sign in to see the AI explanation'
                      : isLoadingAi
                      ? 'Refyn AI is working…'
                      : 'Explain with Refyn AI'}
                  </span>
                  {!aiReady && (
                    <span className="rounded bg-surface px-1.5 py-0.5 font-body text-[0.625rem] font-semibold uppercase tracking-wide">
                      Soon
                    </span>
                  )}
                  {aiReady && !canUseAi && (
                    <span className="rounded bg-surface px-1.5 py-0.5 font-body text-[0.625rem] font-semibold uppercase tracking-wide">
                      Sign in
                    </span>
                  )}
                </button>
              )}

              {!canUseAi && !explanation && (
                <p className="mt-2 font-body text-xs text-text-muted">{AI_SIGN_IN_MESSAGE}</p>
              )}

              {aiError && <p className="mt-2 font-body text-xs text-text-muted">{aiError}</p>}

              {/* The AI answer, in a gradient-lit panel. The border is a
                  1.5px gradient sheet with the surface laid back over it —
                  a `border-image` can't be rounded, and a ring can't be a
                  three-stop gradient. */}
              {explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="relative rounded-2xl p-[1.5px] shadow-glow-soft"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--indigo-500), var(--violet-500) 45%, var(--cyan-400))',
                  }}
                >
                  <div className="relative rounded-[calc(1rem-0.5px)] bg-surface p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-accent text-accent-text shadow-glow-soft">
                          <SparkleIcon />
                        </span>
                        <div className="min-w-0">
                          <div className="font-body text-[0.8125rem] font-bold tracking-[-0.01em] text-text-primary">
                            Refyn AI
                          </div>
                          <div className="truncate font-body text-[0.625rem] font-medium text-text-muted">
                            {isCorrect
                              ? 'What makes it faster next time'
                              : skipped
                              ? 'How to open this one'
                              : 'Why you fell for the trap'}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent-subtle px-2.5 py-1 font-body text-[0.59375rem] font-semibold uppercase tracking-[0.06em] text-accent">
                        Personalised
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {blocks.map((block, i) => (
                        <div key={i} className="flex gap-2.5">
                          {block.n && (
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-subtle font-mono text-[0.6875rem] font-bold text-accent">
                              {block.n}
                            </span>
                          )}
                          <p
                            className={clsx(
                              'font-body text-[0.8125rem] leading-[1.55] text-text-secondary',
                              !block.n && 'w-full'
                            )}
                          >
                            <MathText>{block.text}</MathText>
                          </p>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleExplain}
                      disabled={isLoadingAi}
                      className="mt-3.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-raised font-body text-[0.78125rem] font-semibold text-text-secondary transition-colors hover:border-text-faint disabled:opacity-60"
                    >
                      {isLoadingAi ? (
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Icon name="refresh" size={14} strokeWidth={2.2} />
                      )}
                      Ask again
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
