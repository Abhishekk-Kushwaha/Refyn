import { useQuery } from '@tanstack/react-query';
import { getDailyFocus, frequencyBandOf, FrequencyBand } from '@/services/dailyFocus.service';
import { SubtopicWeakness } from '@/services/weakness.service';

/**
 * Coaching prose for the concept the engine picked.
 *
 * Cached hard on the client as well as the server: the message depends only on
 * (concept, band), so it cannot change until the learner's band actually
 * moves. Re-fetching on every dashboard mount would spend requests to render
 * identical text.
 */
export const useDailyFocus = (
  subtopic: SubtopicWeakness | undefined,
  frequencyWeight?: number
) => {
  const frequencyBand: FrequencyBand = frequencyBandOf(frequencyWeight);

  return useQuery({
    // Band is part of the key: when the learner improves out of 'weak' into
    // 'improving', they should get the message for where they now are.
    queryKey: ['daily-focus', subtopic?.subtopicId, subtopic?.band],
    queryFn: () => getDailyFocus(subtopic!, frequencyBand),
    enabled: Boolean(subtopic),
    staleTime: 1000 * 60 * 60, // an hour; the underlying text is immutable
    retry: false, // the service already degrades to fallback copy
  });
};
