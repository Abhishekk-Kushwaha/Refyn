import { useQuery } from '@tanstack/react-query';
import { getSkipSnapshot } from '@/services/skipInsights.service';
import { useExamStore } from '@/stores/examStore';

/**
 * Skip behaviour per concept. Reads straight off AWE state — no network, no
 * model — so it is available the moment the dashboard mounts.
 */
export const useSkipInsights = () => {
  const examId = useExamStore((state) => state.selectedExamId) ?? 'cat';

  return useQuery({
    queryKey: ['skip-insights', examId],
    queryFn: () => getSkipSnapshot(),
    staleTime: 0, // reflect the latest session as soon as the dashboard opens
  });
};
