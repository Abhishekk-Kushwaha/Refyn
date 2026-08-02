import { MockQuestion } from '@/lib/mockQuestions';
import { Input, MathText } from '@/components/ui';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface QuestionCardProps {
  question: MockQuestion;
  selectedAnswer: string | null;
  onSelectOption: (option: string) => void;
  titaValue: string;
  onTitaChange: (value: string) => void;
}

const optionKeys = ['a', 'b', 'c', 'd'] as const;

export const QuestionCard = ({
  question,
  selectedAnswer,
  onSelectOption,
  titaValue,
  onTitaChange,
}: QuestionCardProps) => {
  return (
    <div className="flex flex-1 flex-col">
      {/* Subtopic tag */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-accent-muted bg-accent-subtle px-2.5 py-1 font-body text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-accent">
          {question.subtopicName}
        </span>
        <span className="rounded-full border border-border bg-surface-raised px-2.5 py-1 font-body text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-text-faint">
          {question.questionType === 'mcq' ? 'Multiple choice' : 'Type in the answer'}
        </span>
      </div>

      {/* Question text — capped at a readable measure even on a wide screen. */}
      <p className="mb-7 max-w-prose font-body text-[1.0625rem] leading-[1.7] text-text-primary lg:text-lg">
        <MathText>{question.questionText}</MathText>
      </p>

      {/* MCQ options. Two columns on wide screens: four full-width rows on a
          1600px display is exactly the "phone stretched out" effect. */}
      {question.questionType === 'mcq' && question.options && (
        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
          {optionKeys.map((key) => {
            const isSelected = selectedAnswer === key;
            return (
              <motion.button
                key={key}
                onClick={() => onSelectOption(key)}
                whileTap={{ scale: 0.99 }}
                aria-pressed={isSelected}
                className={clsx(
                  'flex w-full items-center gap-3.5 rounded-xl border p-4 text-left',
                  'transition-[border-color,background,box-shadow] duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  isSelected
                    ? 'border-accent bg-accent-subtle text-text-primary shadow-glow-soft'
                    : 'border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-raised'
                )}
              >
                <span
                  className={clsx(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-lg border font-body text-xs font-bold uppercase transition-colors',
                    isSelected
                      ? 'border-transparent bg-gradient-accent text-white'
                      : 'border-border-strong text-text-muted'
                  )}
                >
                  {key}
                </span>
                <span className="flex-1 font-body text-[0.9375rem] leading-relaxed">
                  <MathText>{question.options![key]}</MathText>
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* TITA input */}
      {question.questionType === 'tita' && (
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
    </div>
  );
};
