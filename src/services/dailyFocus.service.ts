import { env } from '@/config/env';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase/client';
import { SubtopicWeakness, WeaknessBand } from '@/services/weakness.service';

// The dashboard's "hit this hard today" line.
//
// The AWE engine chooses the concept — it already ranks weakness from real
// accuracy, recency and CAT frequency. This service only fetches the prose
// that explains the choice, and it is deliberately allowed to fail: if the
// endpoint is unset or unreachable, fallbackMessage() gives the card
// something honest to say and the dashboard looks no different.
//
// The returned text never contains the learner's own numbers. It is cached
// server-side per (concept, band) and shared across every learner in that
// state, so the card renders real accuracy and attempt counts separately.

export type FrequencyBand = 'low' | 'medium' | 'high' | 'very_high';

export interface DailyFocus {
  message: string;
  /** False when this came from the local fallback rather than the model. */
  fromModel: boolean;
}

export const isFocusCoachConfigured = (): boolean => Boolean(env.aiFocusUrl);

/**
 * Buckets the engine's frequencyWeight (1.3 very_high … 0.4 low) back into the
 * band the copy is written against.
 */
export const frequencyBandOf = (weight: number | undefined): FrequencyBand => {
  if (weight === undefined) return 'medium';
  if (weight >= 1.2) return 'very_high';
  if (weight >= 0.9) return 'high';
  if (weight >= 0.6) return 'medium';
  return 'low';
};

const FALLBACK: Record<WeaknessBand, string> = {
  critical:
    'This is the weakest area in your profile right now, and it carries real weight in CAT. A focused set here moves your score more than anything else today.',
  weak: 'You are getting more of these wrong than right, and it comes up often enough to matter. Twenty minutes of deliberate practice here pays off quickly.',
  learning:
    'You are still inconsistent on this one — the method is landing some days and not others. A short set today is what turns it from shaky into dependable.',
  improving:
    'This one is trending your way but is not reliable yet. Keep the momentum with a set today so the gain sticks.',
  strong:
    'You are solid here, so this is about staying sharp rather than fixing anything. A quick set keeps it from slipping.',
  untested:
    'You have not practised this yet, so it is a blind spot rather than a known weakness. A first set today tells you where you actually stand.',
};

/** Engine-only copy. Used when the coach endpoint is unset or fails. */
export const fallbackMessage = (band: WeaknessBand): string => FALLBACK[band];

export const getDailyFocus = async (
  subtopic: SubtopicWeakness,
  frequencyBand: FrequencyBand
): Promise<DailyFocus> => {
  if (!isFocusCoachConfigured()) {
    return { message: fallbackMessage(subtopic.band), fromModel: false };
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (isSupabaseConfigured) {
      const {
        data: { session },
      } = await getSupabase().auth.getSession();
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
        headers.apikey = env.supabaseAnonKey;
      }
    }

    const response = await fetch(env.aiFocusUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conceptKey: subtopic.subtopicId,
        conceptName: subtopic.subtopicName,
        topicName: subtopic.topicName,
        band: subtopic.band,
        frequencyBand,
      }),
    });

    if (!response.ok) return { message: fallbackMessage(subtopic.band), fromModel: false };

    const data = (await response.json()) as { message?: string };
    if (!data.message) return { message: fallbackMessage(subtopic.band), fromModel: false };

    return { message: data.message, fromModel: true };
  } catch {
    // Coaching is decoration on top of a working dashboard. Never surface this.
    return { message: fallbackMessage(subtopic.band), fromModel: false };
  }
};
