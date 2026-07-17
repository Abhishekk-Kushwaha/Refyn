import { create } from 'zustand';
import { MockQuestion } from '@/lib/mockQuestions';

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
  submitAnswer: (selectedAnswer: string, timeTakenSeconds: number) => void;
  skipCurrent: (timeTakenSeconds: number) => void;
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
    if (!question) return;

    const isCorrect =
      selectedAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();

    set({
      answers: {
        ...answers,
        [question.id]: {
          questionId: question.id,
          selectedAnswer,
          isCorrect,
          timeTakenSeconds,
          markedForReview: answers[question.id]?.markedForReview ?? false,
          skipped: false,
        },
      },
    });
  },

  skipCurrent: (timeTakenSeconds) => {
    const { questions, currentIndex, answers } = get();
    const question = questions[currentIndex];
    if (!question) return;

    set({
      answers: {
        ...answers,
        [question.id]: {
          questionId: question.id,
          selectedAnswer: null,
          isCorrect: false,
          timeTakenSeconds,
          markedForReview: answers[question.id]?.markedForReview ?? false,
          skipped: true,
        },
      },
    });
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
