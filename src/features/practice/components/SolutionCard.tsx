import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { MockQuestion } from '@/lib/mockQuestions';
import { AnswerRecord } from '@/stores/sessionStore';
import { getErrorMessage } from '@/lib/errors';
import {
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
    className={clsx('w-4 h-4', className)}
  >
    <path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
    <path d="M18.5 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" opacity="0.7" />
    <path d="M5 15l.7 2 2 .7-2 .7L5 20.4l-.7-2-2-.7 2-.7L5 15z" opacity="0.5" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={clsx('w-4 h-4 transition-transform duration-200', open && 'rotate-180')}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const SolutionCard = ({ question, answer, index }: SolutionCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const skipped = !answer || answer.skipped || answer.selectedAnswer === null;
  const isCorrect = !skipped && answer.isCorrect;
  const status = skipped ? 'skipped' : isCorrect ? 'correct' : 'wrong';
  const aiReady = isAiExplainerConfigured();

  const statusLabel = { correct: 'Correct', wrong: 'Wrong', skipped: 'Skipped' }[status];
  const statusClass = {
    correct: 'bg-success-subtle text-success',
    wrong: 'bg-danger-subtle text-danger',
    skipped: 'bg-surface-raised text-text-muted',
  }[status];

  const answerText = (key: string | null) => {
    if (key === null) return '—';
    if (question.questionType === 'tita' || !question.options) return key;
    const option = question.options[key as keyof typeof question.options];
    return option ? `${key.toUpperCase()}. ${option}` : key;
  };

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

  return (
    <div
      className={clsx(
        'bg-surface rounded-lg border-l-4 overflow-hidden',
        status === 'correct'
          ? 'border-l-success'
          : status === 'wrong'
          ? 'border-l-danger'
          : 'border-l-border-strong'
      )}
    >
      {/* Header — always visible, toggles the solution */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-surface-raised transition-colors"
      >
        <span className="text-xs font-bold text-text-muted font-mono mt-0.5 flex-shrink-0">
          Q{index + 1}
        </span>
        <span className="flex-1 min-w-0">
          <span className={clsx('block text-sm text-text-primary', !isOpen && 'truncate')}>
            {question.questionText}
          </span>
          <span className="flex items-center gap-2 mt-1.5">
            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', statusClass)}>
              {statusLabel}
            </span>
            <span className="text-[10px] text-text-muted">{question.subtopicName}</span>
          </span>
        </span>
        <span className="text-text-muted flex-shrink-0 mt-0.5">
          <ChevronIcon open={isOpen} />
        </span>
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
            <div className="px-4 pb-4 pt-1 border-t border-border">
              {/* Full question text (header truncates it) */}
              <p className="text-sm text-text-primary leading-relaxed mt-3 mb-4">
                {question.questionText}
              </p>

              {/* MCQ options with correct / chosen markers */}
              {question.questionType === 'mcq' && question.options && (
                <div className="space-y-2 mb-4">
                  {optionKeys.map((key) => {
                    const isRight = question.correctAnswer.trim().toLowerCase() === key;
                    const isChosen = answer?.selectedAnswer === key;
                    return (
                      <div
                        key={key}
                        className={clsx(
                          'flex items-center gap-2 p-2.5 rounded-md border text-sm',
                          isRight
                            ? 'border-success bg-success-subtle text-text-primary'
                            : isChosen
                            ? 'border-danger bg-danger-subtle text-text-primary'
                            : 'border-border text-text-muted'
                        )}
                      >
                        <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold uppercase flex-shrink-0">
                          {key}
                        </span>
                        <span className="flex-1">{question.options![key]}</span>
                        {isRight && <span className="text-xs font-semibold text-success">Correct</span>}
                        {isChosen && !isRight && (
                          <span className="text-xs font-semibold text-danger">Your answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TITA — no options to mark up, so show the two values side by side */}
              {question.questionType === 'tita' && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-surface-raised rounded-md p-3">
                    <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
                      Your answer
                    </div>
                    <div className={clsx('font-mono text-sm', isCorrect ? 'text-success' : 'text-danger')}>
                      {answerText(answer?.selectedAnswer ?? null)}
                    </div>
                  </div>
                  <div className="bg-surface-raised rounded-md p-3">
                    <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
                      Correct answer
                    </div>
                    <div className="font-mono text-sm text-success">{question.correctAnswer}</div>
                  </div>
                </div>
              )}

              {/* Authored solution */}
              <div className="bg-surface-raised rounded-md p-3 mb-3">
                <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1.5">
                  Solution
                </div>
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                  {question.solution || 'A written solution has not been added for this question yet.'}
                </p>
              </div>

              {/* AI explanation — button is live now, the model plugs in behind ai.service */}
              <button
                onClick={handleExplain}
                disabled={isLoadingAi}
                className={clsx(
                  'w-full flex items-center gap-2 p-2.5 rounded-md border border-accent bg-accent-subtle',
                  'text-accent text-sm font-semibold transition-all hover:border-accent',
                  'disabled:opacity-60 disabled:cursor-not-allowed'
                )}
              >
                {isLoadingAi ? (
                  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <SparkleIcon className="flex-shrink-0" />
                )}
                <span className="flex-1 text-left">
                  {explanation ? 'Regenerate AI explanation' : 'Explain with AI'}
                </span>
                {!aiReady && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide bg-surface px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </button>

              {aiError && <p className="text-xs text-text-muted mt-2">{aiError}</p>}

              {explanation && (
                <div className="mt-3 rounded-md border border-accent bg-accent-subtle p-3">
                  <div className="flex items-center gap-1.5 text-accent text-[10px] uppercase tracking-widest font-semibold mb-1.5">
                    <SparkleIcon className="w-3 h-3" />
                    AI explanation
                  </div>
                  <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                    {explanation}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
