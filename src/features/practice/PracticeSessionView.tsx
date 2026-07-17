import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { useSessionStore } from '@/stores/sessionStore';
import { Timer, TimerHandle } from './components/Timer';
import { QuestionCard } from './components/QuestionCard';

export const PracticeSessionView = () => {
  const navigate = useNavigate();
  const timerRef = useRef<TimerHandle>(null);

  const {
    questions,
    currentIndex,
    answers,
    isTimed,
    submitAnswer,
    skipCurrent,
    toggleMark,
    goNext,
    endSession,
  } = useSessionStore();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [titaValue, setTitaValue] = useState('');

  const question = questions[currentIndex];
  const currentAnswer = question ? answers[question.id] : undefined;

  // Reset local input state when moving to a new question
  useEffect(() => {
    setSelectedOption(null);
    setTitaValue('');
    timerRef.current?.reset();
  }, [currentIndex]);

  if (questions.length === 0) {
    return (
      <EmptyState
        icon="🎯"
        title="No active session"
        description="Start a new practice session from the practice screen."
        action={{ label: 'Go to Practice', onClick: () => navigate('/practice') }}
        className="min-h-screen"
      />
    );
  }

  const hasAnswer = question.questionType === 'mcq' ? !!selectedOption : titaValue.trim().length > 0;

  const advance = () => {
    const hasNext = goNext();
    if (!hasNext) {
      endSession();
      navigate('/practice/review');
    }
  };

  const handleSubmit = () => {
    const elapsed = timerRef.current?.getElapsedSeconds() ?? 0;
    const answer = question.questionType === 'mcq' ? selectedOption! : titaValue.trim();
    submitAnswer(answer, elapsed);
    advance();
  };

  const handleSkip = () => {
    const elapsed = timerRef.current?.getElapsedSeconds() ?? 0;
    skipCurrent(elapsed);
    advance();
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/practice')}
            className="text-text-muted hover:text-text-primary transition-colors"
            aria-label="Exit session"
          >
            ← Exit
          </button>

          <span className="font-mono font-semibold text-text-primary">
            Q {currentIndex + 1} / {questions.length}
          </span>

          <button
            onClick={toggleMark}
            className={`text-xl transition-colors ${
              currentAnswer?.markedForReview ? 'opacity-100' : 'opacity-40 hover:opacity-70'
            }`}
            aria-label="Mark for review"
            title="Mark for review"
          >
            📌
          </button>
        </div>

        {/* Timer */}
        {isTimed && (
          <div className="mb-6 flex justify-center">
            <Timer ref={timerRef} warnAtSeconds={question.expectedTimeSeconds} />
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full bg-border rounded-full h-1.5 mb-6">
          <div
            className="bg-accent h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <QuestionCard
              question={question}
              selectedAnswer={selectedOption}
              onSelectOption={setSelectedOption}
              titaValue={titaValue}
              onTitaChange={setTitaValue}
            />
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex gap-2 mt-8 pt-4 border-t border-border">
          <Button variant="ghost" onClick={handleSkip} className="flex-shrink-0">
            Skip
          </Button>
          <Button
            fullWidth
            onClick={handleSubmit}
            disabled={!hasAnswer}
          >
            {currentIndex + 1 === questions.length ? 'Finish Session' : 'Submit & Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};
