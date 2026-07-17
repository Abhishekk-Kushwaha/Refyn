import { MockQuestion } from '@/lib/mockQuestions';
import { Input } from '@/components/ui';
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
    <div className="flex-1 flex flex-col">
      {/* Subtopic tag */}
      <div className="mb-3">
        <span className="text-xs font-semibold text-accent bg-accent-subtle px-2 py-1 rounded-full">
          {question.subtopicName}
        </span>
      </div>

      {/* Question text */}
      <p className="text-lg text-text-primary leading-relaxed mb-6">
        {question.questionText}
      </p>

      {/* MCQ options */}
      {question.questionType === 'mcq' && question.options && (
        <div className="space-y-3">
          {optionKeys.map((key) => {
            const isSelected = selectedAnswer === key;
            return (
              <motion.button
                key={key}
                onClick={() => onSelectOption(key)}
                whileTap={{ scale: 0.98 }}
                className={clsx(
                  'w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-3',
                  isSelected
                    ? 'bg-accent-subtle border-accent text-accent'
                    : 'border-border text-text-primary hover:border-border-strong'
                )}
              >
                <span
                  className={clsx(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold uppercase flex-shrink-0',
                    isSelected ? 'border-accent bg-accent text-accent-text' : 'border-border-strong'
                  )}
                >
                  {key}
                </span>
                <span className="flex-1">{question.options![key]}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* TITA input */}
      {question.questionType === 'tita' && (
        <div>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Type your numeric answer"
            value={titaValue}
            onChange={(e) => onTitaChange(e.target.value)}
            label="Your Answer"
            className="text-lg font-mono"
          />
          <p className="text-xs text-text-muted mt-2">
            TITA (Type-In-The-Answer) — no options, enter the exact value.
          </p>
        </div>
      )}
    </div>
  );
};
