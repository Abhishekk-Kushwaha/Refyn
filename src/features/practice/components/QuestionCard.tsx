import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { MockQuestion } from '@/lib/mockQuestions';
import { Icon, Input, MathText } from '@/components/ui';
import { normalizeAnswer } from '@/lib/grading';

export interface QuestionReveal {
  /** What the learner submitted. Null when the question was skipped. */
  given: string | null;
  correct: boolean;
}

interface QuestionCardProps {
  question: MockQuestion;
  selectedAnswer: string | null;
  onSelectOption: (option: string) => void;
  titaValue: string;
  onTitaChange: (value: string) => void;
  /**
   * Set once the answer is in. The card stops being an input and becomes the
   * teaching moment: the right answer surfaces, the miss is named, and the
   * authored solution slides in under both.
   */
  reveal?: QuestionReveal;
  /** Rendered opposite the subtopic pill — the pace ring, or the outcome. */
  meta?: ReactNode;
}

const optionKeys = ['a', 'b', 'c', 'd'] as const;
type OptionKey = (typeof optionKeys)[number];

/** Which of the four reveal treatments a row gets. */
type OptionState = 'idle' | 'selected' | 'correct' | 'missed' | 'dimmed';

const optionState = (
  key: OptionKey,
  question: MockQuestion,
  selectedAnswer: string | null,
  reveal?: QuestionReveal
): OptionState => {
  if (!reveal) return selectedAnswer === key ? 'selected' : 'idle';
  if (normalizeAnswer(question.correctAnswer) === key) return 'correct';
  if (reveal.given === key) return 'missed';
  return 'dimmed';
};

export const QuestionCard = ({
  question,
  selectedAnswer,
  onSelectOption,
  titaValue,
  onTitaChange,
  reveal,
  meta,
}: QuestionCardProps) => {
  const correctKey = normalizeAnswer(question.correctAnswer) as OptionKey;

  return (
    <div className="flex flex-1 flex-col">
      {/* Subtopic tag + pace */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate rounded-full bg-accent-subtle px-3 py-1.5 font-body text-[0.6875rem] font-semibold tracking-[0.06em] text-accent">
          {question.subtopicName}
        </span>
        {meta}
      </div>

      {/* Question text — capped at a readable measure even on a wide screen. */}
      <p className="mb-5 max-w-prose font-body text-[1.0625rem] leading-[1.5] text-text-primary lg:text-lg">
        <MathText>{question.questionText}</MathText>
      </p>

      {/* MCQ options. Two columns on wide screens: four full-width rows on a
          1600px display is exactly the "phone stretched out" effect. */}
      {question.questionType === 'mcq' && question.options && (
        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
          {optionKeys.map((key) => {
            const state = optionState(key, question, selectedAnswer, reveal);
            const locked = !!reveal;

            return (
              <motion.button
                key={key}
                onClick={() => !locked && onSelectOption(key)}
                whileTap={locked ? undefined : { scale: 0.985 }}
                disabled={locked}
                aria-pressed={!locked && state === 'selected'}
                className={clsx(
                  'flex w-full items-center gap-3.5 rounded-xl border-[1.5px] p-4 text-left',
                  'transition-[border-color,background,box-shadow,opacity] duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  'disabled:cursor-default',
                  state === 'selected' && 'border-accent bg-accent-subtle shadow-glow-soft',
                  state === 'correct' && 'border-success bg-success-subtle',
                  state === 'missed' && 'border-danger bg-danger-subtle',
                  state === 'dimmed' && 'border-border opacity-50',
                  state === 'idle' &&
                    'border-border bg-surface hover:border-border-strong hover:bg-surface-raised'
                )}
              >
                <span
                  className={clsx(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-full font-body text-xs font-bold uppercase transition-colors',
                    state === 'selected' && 'bg-gradient-accent text-white',
                    state === 'correct' && 'bg-success text-white',
                    state === 'missed' && 'bg-danger text-white',
                    (state === 'idle' || state === 'dimmed') &&
                      'border-[1.5px] border-border-strong text-text-secondary'
                  )}
                >
                  {state === 'correct' ? (
                    <Icon name="check" size={15} strokeWidth={3} />
                  ) : state === 'missed' ? (
                    <Icon name="close" size={14} strokeWidth={3} />
                  ) : (
                    key
                  )}
                </span>

                <span
                  className={clsx(
                    'min-w-0 flex-1 font-body text-[0.9375rem] leading-relaxed text-text-primary',
                    (state === 'selected' || state === 'correct' || state === 'missed') &&
                      'font-semibold'
                  )}
                >
                  <MathText>{question.options![key]}</MathText>
                </span>

                {state === 'selected' && (
                  <Icon name="check" size={18} strokeWidth={2.6} className="text-accent" />
                )}
                {state === 'correct' && (
                  <span className="shrink-0 font-body text-[0.625rem] font-bold uppercase tracking-[0.1em] text-success">
                    Correct
                  </span>
                )}
                {state === 'missed' && (
                  <span className="shrink-0 font-body text-[0.625rem] font-bold uppercase tracking-[0.1em] text-danger">
                    You
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* TITA input */}
      {question.questionType === 'tita' && !reveal && (
        <div className="max-w-md">
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Type your numeric answer"
            value={titaValue}
            onChange={(e) => onTitaChange(e.target.value)}
            label="Your answer"
            className="font-mono text-lg"
          />
          <p className="mt-2 font-body text-xs text-text-muted">
            TITA (Type-In-The-Answer) — no options, enter the exact value.
          </p>
        </div>
      )}

      {/* TITA reveal — the same two-row verdict the options give, without the
          three distractors that don't exist here. */}
      {question.questionType === 'tita' && reveal && (
        <div className="flex max-w-md flex-col gap-2.5">
          <div className="flex items-center gap-3.5 rounded-xl border-[1.5px] border-success bg-success-subtle p-4">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success text-white">
              <Icon name="check" size={15} strokeWidth={3} />
            </span>
            <span className="flex-1 font-mono text-[0.9375rem] font-semibold text-text-primary">
              {question.correctAnswer}
            </span>
            <span className="font-body text-[0.625rem] font-bold uppercase tracking-[0.1em] text-success">
              Correct
            </span>
          </div>

          {!reveal.correct && (
            <div className="flex items-center gap-3.5 rounded-xl border-[1.5px] border-danger bg-danger-subtle p-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-danger text-white">
                <Icon name="close" size={14} strokeWidth={3} />
              </span>
              <span className="flex-1 font-mono text-[0.9375rem] font-semibold text-text-primary">
                {reveal.given?.trim() || 'Skipped'}
              </span>
              <span className="font-body text-[0.625rem] font-bold uppercase tracking-[0.1em] text-danger">
                You
              </span>
            </div>
          )}
        </div>
      )}

      {/* The why. This is the whole reason the session pauses here rather than
          jumping straight to the next question. */}
      {reveal && question.solution && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mt-4 rounded-xl border border-border bg-surface-raised p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <Icon name="bolt" size={15} strokeWidth={2.4} className="text-accent" />
            <span className="font-body text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-accent">
              {reveal.correct || question.questionType === 'tita' || !reveal.given
                ? 'Why it works'
                : `Why ${question.options?.[correctKey] ?? question.correctAnswer}, not ${
                    question.options?.[reveal.given as OptionKey] ?? reveal.given
                  }`}
            </span>
          </div>
          <p className="font-body text-[0.84375rem] leading-relaxed text-text-secondary">
            <MathText>{question.solution}</MathText>
          </p>
        </motion.div>
      )}
    </div>
  );
};
