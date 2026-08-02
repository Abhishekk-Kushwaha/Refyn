import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Button, Display, Panel, PanelHeader } from '@/components/ui';
import { Page } from '@/components/layout';
import { EmptyState } from '@/components/feedback';
import { aweEngine } from '@/engine/engine';
import { ReviewGrade } from '@/engine/types';
import { getFlashcardPool } from '@/services/flashcardPool';

const intervalLabel = (days: number): string => {
  if (days <= 0) return 'in a few minutes';
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  if (days < 60) return 'in 1 month';
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return 'in a year';
};

export const FlashcardsView = () => {
  const navigate = useNavigate();

  const contentById = useMemo(() => new Map(getFlashcardPool().map((c) => [c.id, c])), []);
  const conceptNames = useMemo(
    () => new Map(aweEngine.getMasteries().map((m) => [m.conceptId, m.conceptName])),
    []
  );

  // Cards that exist AND still have content in the current pool — the honest
  // denominator behind the empty states. Counting raw SM-2 state let orphaned
  // entries (from a pool switch) report "all caught up" forever while the deck
  // was permanently empty.
  const liveCount = useMemo(() => aweEngine.getLiveFlashcardStates().length, []);
  const upcoming = useMemo(() => aweEngine.getUpcomingFlashcards(), []);

  // The deck is state, not a frozen snapshot: a card graded "Again" is pushed
  // back on so the student sees it again before leaving.
  const [deck, setDeck] = useState<string[]>(() =>
    aweEngine.getDueFlashcards().map((s) => s.cardId)
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [lastScheduled, setLastScheduled] = useState<number | null>(null);
  // Guards a second click landing inside the 150ms flip-back window —
  // handleReview is not idempotent and would double-advance the SM-2 interval.
  const reviewingRef = useRef(false);

  const cardId = deck[index];
  const state = cardId ? aweEngine.getFlashcardState(cardId) : null;
  const content = cardId ? contentById.get(cardId) : undefined;
  const preview = cardId ? aweEngine.previewCard(cardId) : null;
  const done = deck.length > 0 && index >= deck.length;

  const startStudyAhead = useCallback(() => {
    setDeck(upcoming.map((s) => s.cardId));
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
  }, [upcoming]);

  const handleReview = (grade: ReviewGrade) => {
    if (!cardId || reviewingRef.current) return;
    reviewingRef.current = true;

    const next = aweEngine.reviewFlashcard(cardId, grade);
    setLastScheduled(next.intervalDays);
    setReviewed((n) => n + 1);
    setFlipped(false);

    // A forgotten card comes back inside this session. Hiding it for a day at
    // the exact moment the student needs it again teaches nothing.
    if (grade === 'again') setDeck((d) => [...d, cardId]);

    // small delay so the flip-back animation finishes before the next card slides in
    setTimeout(() => {
      setIndex((i) => i + 1);
      reviewingRef.current = false;
    }, 150);
  };

  // Nothing materialized yet — the engine only queues cards once a concept shows weakness.
  if (liveCount === 0) {
    return (
      <EmptyState
        icon="📚"
        title="No flashcards yet"
        description="Flashcards appear automatically when the engine spots a weak concept. Do a practice session and your weak spots will queue their cards here."
        action={{ label: 'Start Practicing', onClick: () => navigate('/practice') }}
        className="flex-1"
      />
    );
  }

  // Cards exist but none are due right now.
  if (deck.length === 0) {
    const nextDueDays =
      upcoming.length > 0
        ? Math.max(
            0,
            Math.round((new Date(upcoming[0].nextReviewAt).getTime() - Date.now()) / 86_400_000)
          )
        : null;

    return (
      <EmptyState
        icon="✅"
        title="All caught up"
        description={
          nextDueDays !== null
            ? `No cards due right now — the next one is scheduled ${intervalLabel(nextDueDays)}. You can still study ahead.`
            : "No cards due for review right now — spaced repetition will bring them back exactly when you're about to forget."
        }
        action={
          upcoming.length > 0
            ? { label: 'Study Ahead', onClick: startStudyAhead }
            : { label: 'Practice Instead', onClick: () => navigate('/practice') }
        }
        className="flex-1"
      />
    );
  }

  // Finished the deck (or lost the card's content mid-session).
  if (done || !content || !state) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm text-center"
        >
          <div className="mb-4 text-5xl">🎉</div>
          <Display as="h2" size="md" className="mb-3">
            Deck cleared
          </Display>
          <p className="mb-8 font-body text-sm text-text-secondary">
            {reviewed} card{reviewed === 1 ? '' : 's'} reviewed. The engine has rescheduled each one based on how well you recalled it.
          </p>
          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => navigate('/practice')}>
              Practice Now
            </Button>
            <Button size="lg" variant="secondary" fullWidth onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Reviewed count, not index, so a re-queued "Again" card doesn't run the bar
  // backwards — and so it actually reaches 100%.
  const progressPct = Math.min(100, (reviewed / Math.max(deck.length, 1)) * 100);

  const conceptName = conceptNames.get(state.conceptId) ?? state.conceptId;

  return (
    <Page width="default" className="flex flex-col">
      {/* Header + progress */}
      <div className="mb-7">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <Display as="h1" size="lg">
            Review
          </Display>
          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-text-muted">
            <span className="text-text-primary">{index + 1}</span> / {deck.length}
          </span>
        </div>
        <p className="mb-5 font-body text-[0.9375rem] text-text-secondary">
          Spaced-repetition deck. Due today, weakest concepts first.
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-gradient-accent"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:gap-8">
        {/* ---- Card + grading ---------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col justify-center" style={{ perspective: 1600 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${cardId}-${index}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
              >
                <motion.button
                  onClick={() => setFlipped((f) => !f)}
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.45, type: 'spring', damping: 24 }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="relative h-80 w-full cursor-pointer lg:h-[26rem]"
                  aria-label={flipped ? 'Show front' : 'Reveal answer'}
                >
                  {/* Front */}
                  <div
                    style={{ backfaceVisibility: 'hidden' }}
                    aria-hidden={flipped}
                    className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface p-8 shadow-lg lg:p-12"
                  >
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-highlight to-transparent"
                      aria-hidden="true"
                    />
                    <span className="mb-6 rounded-full border border-accent-muted bg-accent-subtle px-3 py-1 font-body text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-accent">
                      {conceptName}
                    </span>
                    <p className="text-balance text-center font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-text-primary lg:text-2xl">
                      {content.front}
                    </p>
                    <p className="mt-8 font-body text-xs text-text-faint">Tap to reveal</p>
                  </div>

                  {/* Back — mounted only once revealed. backfaceVisibility hides it
                      visually but leaves it in the DOM, so screen readers,
                      find-in-page and copy-paste all handed over the answer before
                      the student had tried to recall it. */}
                  <div
                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-accent-muted bg-surface-raised p-8 shadow-lg lg:p-12"
                  >
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-accent-soft"
                      aria-hidden="true"
                    />
                    {flipped && (
                      <div className="relative w-full">
                        {content.backFormula && (
                          <p className="mb-5 text-center font-mono text-lg font-semibold text-accent lg:text-xl">
                            {content.backFormula}
                          </p>
                        )}
                        <p className="mx-auto max-w-prose text-center font-body text-[0.9375rem] leading-relaxed text-text-secondary">
                          {content.backExplanation}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.button>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Review actions — only after the reveal, so the grade means something.
              Three grades, not two: a binary answer gives the SM-2 ease factor
              nothing to adapt with, which left the algorithm's one adaptive
              parameter doing no work. */}
          <div className="mt-6">
            {flipped ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
              >
                <GradeButton
                  label="Again"
                  hint="in minutes"
                  tone="danger"
                  onClick={() => handleReview('again')}
                />
                <GradeButton
                  label="Good"
                  hint={intervalLabel(preview?.good ?? 1)}
                  tone="accent"
                  onClick={() => handleReview('good')}
                />
                <GradeButton
                  label="Easy"
                  hint={intervalLabel(preview?.easy ?? 4)}
                  tone="success"
                  onClick={() => handleReview('easy')}
                />
              </motion.div>
            ) : (
              <p className="flex h-[4.25rem] items-center justify-center text-center font-body text-sm text-text-muted">
                {lastScheduled !== null && reviewed > 0
                  ? `Rescheduled ${intervalLabel(lastScheduled)}`
                  : 'Recall the answer, then tap the card to check yourself'}
              </p>
            )}
          </div>
        </div>

        {/* ---- Desktop session rail ---------------------------------- */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Panel className="sticky top-8">
            <PanelHeader icon="flashcards" title="This session" />

            <dl className="space-y-3">
              <RailStat label="Reviewed" value={String(reviewed)} />
              <RailStat label="In deck" value={String(deck.length)} />
              <RailStat label="Remaining" value={String(Math.max(0, deck.length - index))} />
              <RailStat label="Scheduled ahead" value={String(upcoming.length)} />
            </dl>

            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-1.5 font-body text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-text-muted">
                Current concept
              </p>
              <p className="font-heading text-sm font-semibold text-text-primary">{conceptName}</p>
            </div>

            <p className="mt-5 border-t border-border pt-4 font-body text-[0.6875rem] leading-relaxed text-text-faint">
              Grades drive the SM-2 interval. &ldquo;Again&rdquo; requeues the card inside this
              session rather than hiding it for a day.
            </p>
          </Panel>
        </aside>
      </div>
    </Page>
  );
};

const RailStat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between">
    <dt className="font-body text-[0.8125rem] text-text-muted">{label}</dt>
    <dd className="font-mono text-[0.8125rem] font-semibold tabular-nums text-text-primary">
      {value}
    </dd>
  </div>
);

const gradeTones = {
  danger: 'border-danger/30 bg-danger-subtle text-danger hover:border-danger/60',
  accent: 'border-transparent bg-gradient-accent text-white shadow-glow-soft hover:shadow-glow',
  success: 'border-success/30 bg-success-subtle text-success hover:border-success/60',
} as const;

/** Grade control. The interval preview is the point — it tells the student
 *  what the choice actually costs before they make it. */
const GradeButton = ({
  label,
  hint,
  tone,
  onClick,
}: {
  label: string;
  hint: string;
  tone: keyof typeof gradeTones;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'flex h-[4.25rem] flex-col items-center justify-center rounded-xl border transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
      'active:translate-y-px',
      gradeTones[tone]
    )}
  >
    <span className="font-body text-[0.9375rem] font-bold tracking-[-0.01em]">{label}</span>
    <span className="mt-0.5 font-body text-[0.6875rem] opacity-80">{hint}</span>
  </button>
);
