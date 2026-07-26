import { create } from 'zustand';
import { MockQuestion } from '@/lib/mockQuestions';
import { isAnswerCorrect } from '@/lib/grading';

export interface AnswerRecord {
  questionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
  timeTakenSeconds: number;
  markedForReview: boolean;
  skipped: boolean;
}

type PracticeMode = 'weakness' | 'mock' | 'topic';

interface SessionStore {
  questions: MockQuestion[];
  currentIndex: number;
  answers: Record<string, AnswerRecord>;
  mode: PracticeMode;
  isTimed: boolean;
  isActive: boolean;

  startSession: (questions: MockQuestion[], mode: PracticeMode, isTimed: boolean) => void;
  // Both return the recorded answer so the caller can feed the AWE trigger
  // without re-deriving correctness — one grading path, not two.
  submitAnswer: (
    selectedAnswer: string,
    timeTakenSeconds: number
  ) => { question: MockQuestion; answer: AnswerRecord } | null;
  skipCurrent: (
    timeTakenSeconds: number
  ) => { question: MockQuestion; answer: AnswerRecord } | null;
  toggleMark: () => void;
  goNext: () => boolean;
  endSession: () => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  questions: [],
  currentIndex: 0,
  answers: {},
  mode: 'weakness',
  isTimed: true,
  isActive: false,

  startSession: (questions, mode, isTimed) =>
    set({ questions, mode, isTimed, currentIndex: 0, answers: {}, isActive: true }),

  submitAnswer: (selectedAnswer, timeTakenSeconds) => {
    const { questions, currentIndex, answers } = get();
    const question = questions[currentIndex];
    if (!question) return null;

    // Numeric-aware for TITA: "12.0", "1,200" and ".5" are not wrong answers.
    const answer: AnswerRecord = {
      questionId: question.id,
      selectedAnswer,
      isCorrect: isAnswerCorrect(selectedAnswer, question.correctAnswer),
      timeTakenSeconds,
      markedForReview: answers[question.id]?.markedForReview ?? false,
      skipped: false,
    };

    set({ answers: { ...answers, [question.id]: answer } });
    return { question, answer };
  },

  skipCurrent: (timeTakenSeconds) => {
    const { questions, currentIndex, answers } = get();
    const question = questions[currentIndex];
    if (!question) return null;

    const answer: AnswerRecord = {
      questionId: question.id,
      selectedAnswer: null,
      isCorrect: false,
      timeTakenSeconds,
      markedForReview: answers[question.id]?.markedForReview ?? false,
      skipped: true,
    };

    set({ answers: { ...answers, [question.id]: answer } });
    return { question, answer };
  },

  toggleMark: () => {
    const { questions, currentIndex, answers } = get();
    const question = questions[currentIndex];
    if (!question) return;
    const existing = answers[question.id];

    set({
      answers: {
        ...answers,
        [question.id]: existing
          ? { ...existing, markedForReview: !existing.markedForReview }
          : {
              questionId: question.id,
              selectedAnswer: null,
              isCorrect: false,
              timeTakenSeconds: 0,
              markedForReview: true,
              skipped: true,
            },
      },
    });
  },

  goNext: () => {
    const { currentIndex, questions } = get();
    if (currentIndex + 1 < questions.length) {
      set({ currentIndex: currentIndex + 1 });
      return true;
    }
    return false;
  },

  endSession: () => set({ isActive: false }),

  resetSession: () => set({ questions: [], currentIndex: 0, answers: {}, isActive: false }),
}));
