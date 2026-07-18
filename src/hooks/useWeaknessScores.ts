import { useQuery } from '@tanstack/react-query';
import { getWeaknessSnapshot } from '@/services/weakness.service';
import { useExamStore } from '@/stores/examStore';

export const useWeaknessScores = () => {
  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';

  return useQuery({
    queryKey: ['weakness', examId],
    queryFn: () => getWeaknessSnapshot(examId),
    staleTime: 0, // always reflect the latest attempts when the dashboard mounts
  });
};
