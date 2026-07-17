import { create } from 'zustand';

interface ExamStore {
  selectedExamId: string | null;
  setSelectedExam: (examId: string) => void;
}

export const useExamStore = create<ExamStore>((set) => ({
  selectedExamId: 'cat', // Default to CAT
  setSelectedExam: (examId: string) => {
    set({ selectedExamId: examId });
  },
}));
