import { useState } from 'react';
import {
  Display,
  Eyebrow,
  Icon,
  ModeCard,
  ProgressRail,
  SectionAction,
  SectionHeader,
  StatBar,
  StatPill,
  TopicTile,
  TopicTileRow,
  type RailStep,
  type TopicTone,
} from '../../components/ui';
import type { IconName } from '../../components/ui';

/**
 * Live reference for Refyn's editorial layer.
 *
 * This is a design-system page, not a product screen — it exists so the kit can
 * be checked in a browser without going through auth. Safe to delete once the
 * real screens are restyled; nothing imports from it.
 */

const sections: { id: string; label: string; icon: IconName; tone: TopicTone; stat: string }[] = [
  { id: 'varc', label: 'VARC', icon: 'book', tone: 'topic-a', stat: '72%' },
  { id: 'dilr', label: 'DILR', icon: 'dashboard', tone: 'topic-b', stat: '58%' },
  { id: 'quant', label: 'Quant', icon: 'sigma', tone: 'topic-c', stat: '81%' },
  { id: 'mixed', label: 'Mixed', icon: 'spark', tone: 'topic-d', stat: '66%' },
];

const steps: RailStep[] = [
  { id: 'warmup', label: 'Warmup', icon: 'flame', status: 'done' },
  { id: 'drill', label: 'Drill', icon: 'practice', status: 'current' },
  { id: 'review', label: 'Review', icon: 'flashcards', status: 'locked' },
];

export const DesignSystemView = () => {
  const [selected, setSelected] = useState('quant');

  return (
    <div className="min-h-screen bg-bg pb-16">
      <div className="mx-auto w-full max-w-md px-5 py-6">
        {/* ---- Header: stat bar ---------------------------------------- */}
        <StatBar className="mb-8">
          <StatPill icon="flame" value={12} unit="day" label="Current streak" tone="accent" />
          <StatPill icon="bolt" value="1,240" unit="XP" label="Total experience" />
          <StatPill icon="trend" value="74" unit="%" label="Overall accuracy" />
        </StatBar>

        {/* ---- Editorial headline -------------------------------------- */}
        <div className="mb-8">
          <Eyebrow className="mb-2 block text-accent">Today</Eyebrow>
          <Display size="lg" accentPart="weakness">
            Hunt your
          </Display>
          <p className="mt-3 font-body text-sm leading-relaxed text-text-secondary">
            Three sets queued from your weakest subtopics. Roughly 18 minutes.
          </p>
        </div>

        {/* ---- Progress rail ------------------------------------------- */}
        <div className="mb-8 rounded-2xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <Eyebrow className="text-text-muted">Daily goal</Eyebrow>
            <span className="font-body text-xs font-bold tabular-nums text-accent">1 / 3</span>
          </div>
          <ProgressRail steps={steps} />
        </div>

        {/* ---- Topic tiles --------------------------------------------- */}
        <section className="mb-8">
          <SectionHeader
            title="Sections"
            action={<SectionAction>View all</SectionAction>}
          />
          <TopicTileRow>
            {sections.map((s) => (
              <TopicTile
                key={s.id}
                icon={s.icon}
                label={s.label}
                tone={s.tone}
                stat={s.stat}
                selected={selected === s.id}
                onClick={() => setSelected(s.id)}
              />
            ))}
          </TopicTileRow>
        </section>

        {/* ---- Mode cards ---------------------------------------------- */}
        <section className="mb-8">
          <SectionHeader title="Practice modes" />
          <div className="flex flex-col gap-3">
            <ModeCard
              eyebrow="Adaptive"
              title="Weakness Hunt"
              description="Pulls questions from the subtopics you get wrong most, and keeps adapting as you go."
              meta={['18 min', '20 questions', 'Adaptive']}
              tone="accent"
            />
            <ModeCard
              eyebrow="Timed"
              title="Full Mock"
              description="A complete sectional paper under exam timing, scored the way the real thing is."
              meta={['120 min', '66 questions']}
              tone="topic-b"
            />
            <ModeCard
              eyebrow="Focused"
              title="Topic Drill"
              description="Pick one subtopic and grind it until the accuracy curve flattens."
              meta={['Custom', 'Untimed']}
              tone="topic-c"
            />
          </div>
        </section>

        {/* ---- Icon set ------------------------------------------------- */}
        <section>
          <SectionHeader title="Icon set" />
          <div className="grid grid-cols-5 gap-2 rounded-2xl border border-border bg-surface p-4">
            {(
              [
                'dashboard', 'practice', 'flashcards', 'board', 'profile',
                'sigma', 'book', 'flame', 'bolt', 'clock',
                'trend', 'spark', 'check', 'chevronRight', 'lock',
              ] as IconName[]
            ).map((n) => (
              <div key={n} className="flex flex-col items-center gap-1.5 py-2">
                <Icon name={n} size={22} className="text-text-secondary" />
                <span className="font-body text-[0.5625rem] text-text-muted">{n}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DesignSystemView;
