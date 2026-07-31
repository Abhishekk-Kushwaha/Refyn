import { useQuery } from '@tanstack/react-query';
import {
  getDailyFocus,
  frequencyBandOf,
  FrequencyBand,
  FocusStats,
} from '@/services/dailyFocus.service';
import { SubtopicWeakness } from '@/services/weakness.service';

/**
 * The learner's briefing for today.
 *
 * Keyed on the date so it is fetched once per day and then reused: the server
 * stores one row per learner per day, so every later login reads that row
 * instead of calling a model. Cost tracks daily active users, not logins.
 */
export const useDailyFocus = (
  subtopic: SubtopicWeakness | undefined,
  frequencyWeight: number | undefined,
  stats: FocusStats
) => {
  const frequencyBand: FrequencyBand = frequencyBandOf(frequencyWeight);
  const today = new Date().toDateString();

  return useQuery({
    queryKey: ['daily-focus', subtopic?.subtopicId, today],
    queryFn: () => getDailyFocus(subtopic!, frequencyBand, stats),
    enabled: Boolean(subtopic),
    // The briefing is written once a day; nothing it says changes in between.
    staleTime: 1000 * 60 * 60 * 6,
    retry: false, // the service already degrades to fallback copy
  });
};
