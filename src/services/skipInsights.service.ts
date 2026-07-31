import { aweEngine } from '@/engine/engine';
import { rankSkipConcerns, SkipBehaviour } from '@/engine/skipProfile';

// Read model for the skip panel. Pure projection over AWE state — the
// classification itself lives in the engine (skipProfile.ts), so the same
// verdict is available to the dashboard, to the daily briefing, and to any
// future consumer without being re-derived differently in each.

export interface SkipConcern {
  conceptId: string;
  conceptName: string;
  topicName: string;
  behaviour: SkipBehaviour;
  skips: number;
  skipRate: number;
  avgSkipSeconds: number | null;
  avgSkipDifficulty: number | null;
  skipsEasy: number;
  skipsHard: number;
  summary: string;
}

export interface SkipSnapshot {
  concerns: SkipConcern[];
  totalSkips: number;
  /** Seconds spent on questions that were then abandoned. */
  totalSecondsLost: number;
}

export const getSkipSnapshot = async (): Promise<SkipSnapshot> => {
  const masteries = aweEngine.getMasteries();

  return {
    concerns: rankSkipConcerns(masteries),
    totalSkips: masteries.reduce((sum, m) => sum + m.skips, 0),
    totalSecondsLost: Math.round(masteries.reduce((sum, m) => sum + m.skipTimeTotal, 0)),
  };
};
