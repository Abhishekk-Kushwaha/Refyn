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
import { TopicWeakness } from '@/services/weakness.service';

interface WeaknessRadarProps {
  topics: TopicWeakness[];
}

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

export const WeaknessRadar = ({ topics }: WeaknessRadarProps) => {
  const colors = useTokenColors();

  // One axis per tested topic — renders N axes dynamically, never a hardcoded
  // shape (Architecture doc Rule 3). A radar needs ≥3 axes to read as an area.
  const data = topics.map((t) => ({
    topic: t.topicName,
    score: t.weaknessScore,
  }));

  if (data.length < 3) {
    return (
      <div className="flex items-center justify-center h-64 text-center px-6">
        <p className="text-text-muted text-sm">
          Practice at least 3 topics to unlock your weakness radar. So far you've
          touched {data.length}.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-72">
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
