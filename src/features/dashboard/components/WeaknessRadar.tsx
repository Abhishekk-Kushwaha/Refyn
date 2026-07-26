import { useEffect, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import { useThemeStore } from '@/stores/themeStore';
import { SubtopicWeakness, TopicWeakness } from '@/services/weakness.service';

interface WeaknessRadarProps {
  topics: TopicWeakness[];
  /**
   * Axes to fall back to when the student's practice sits inside fewer than
   * three parent topics. Drilling one topic deeply is normal — and it used to
   * leave the radar permanently locked behind "practice at least 3 topics"
   * while a dozen weak subtopics sat listed right underneath it.
   */
  subtopics?: SubtopicWeakness[];
}

/** A radar needs at least this many axes to read as an area rather than a line. */
const MIN_AXES = 3;
const MAX_AXES = 8;

// Recharts can't read CSS classes for data colors, so resolve the semantic tokens
// to concrete hex at render time (Theming doc §5). Re-resolve whenever the theme
// flips so the chart re-colors with everything else.
const useTokenColors = () => {
  const theme = useThemeStore((state) => state.theme);
  const [colors, setColors] = useState({ accent: '#f59e0b', muted: '#71717a', grid: '#27272a' });

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setColors({
      accent: styles.getPropertyValue('--accent').trim() || '#f59e0b',
      muted: styles.getPropertyValue('--text-muted').trim() || '#71717a',
      grid: styles.getPropertyValue('--border').trim() || '#27272a',
    });
  }, [theme]);

  return colors;
};

export const WeaknessRadar = ({ topics, subtopics = [] }: WeaknessRadarProps) => {
  const colors = useTokenColors();

  // One axis per tested topic — renders N axes dynamically, never a hardcoded
  // shape (Architecture doc Rule 3).
  const topicAxes = topics.map((t) => ({ topic: t.topicName, score: t.weaknessScore }));

  // Not enough parent topics to plot? Plot the subtopics instead. The data is
  // there either way, and the whole point of the map is to show it.
  const usingSubtopics = topicAxes.length < MIN_AXES && subtopics.length >= MIN_AXES;
  const data = (
    usingSubtopics
      ? subtopics
          .slice(0, MAX_AXES)
          .map((s) => ({ topic: s.subtopicName, score: s.weaknessScore }))
      : topicAxes.slice(0, MAX_AXES)
  );

  if (data.length < MIN_AXES) {
    const touched = Math.max(topicAxes.length, subtopics.length);
    return (
      <div className="flex items-center justify-center h-64 text-center px-6">
        <p className="text-text-muted text-sm">
          Practice at least {MIN_AXES} concepts to unlock your weakness radar. So far
          you've touched {touched}.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
      {usingSubtopics && (
        <p className="text-text-muted text-xs text-center mb-1">
          Showing concepts — practice more topics to compare sections
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={colors.grid} />
          <PolarAngleAxis
            dataKey="topic"
            tick={{ fill: colors.muted, fontSize: 12 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke={colors.accent}
            fill={colors.accent}
            fillOpacity={0.35}
            isAnimationActive
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};
