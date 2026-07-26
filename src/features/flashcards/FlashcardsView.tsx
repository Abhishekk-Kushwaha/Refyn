import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Display } from '@/components/ui';
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

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
      {/* Header + progress */}
      <div className="mb-8">
        <div className="mb-2 flex items-baseline justify-between">
          <Display as="h1" size="md">
            Review
          </Display>
          <span className="font-body text-xs font-mono tabular-nums text-text-muted">
            {index + 1} / {deck.length}
          </span>
        </div>
        <p className="mb-4 font-body text-sm text-text-secondary">
          Spaced-repetition deck. Due today, weakest concepts first.
        </p>
        <div className="h-1 w-full rounded-full bg-border">
          <div
            className="h-1 rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Flip card */}
      <div className="flex-1 flex flex-col justify-center" style={{ perspective: 1200 }}>
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
              transition={{ duration: 0.4, type: 'spring', damping: 22 }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative w-full h-72 cursor-pointer"
              aria-label={flipped ? 'Show front' : 'Reveal answer'}
            >
              {/* Front */}
              <div
                style={{ backfaceVisibility: 'hidden' }}
                aria-hidden={flipped}
                className="absolute inset-0 bg-surface rounded-lg shadow-lg border border-border flex flex-col items-center justify-center p-8"
              >
                <span className="text-xs font-semibold text-accent bg-accent-subtle px-2 py-1 rounded-full mb-4">
                  {conceptNames.get(state.conceptId) ?? state.conceptId}
                </span>
                <p className="text-xl text-text-primary text-center font-medium leading-relaxed">
                  {content.front}
                </p>
                <p className="text-xs text-text-muted mt-6">✋ Tap to reveal</p>
              </div>

              {/* Back — mounted only once revealed. backfaceVisibility hides it
                  visually but leaves it in the DOM, so screen readers,
                  find-in-page and copy-paste all handed over the answer before
                  the student had tried to recall it. */}
              <div
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                className="absolute inset-0 bg-surface-raised rounded-lg shadow-lg border border-accent flex flex-col items-center justify-center p-8"
              >
                {flipped && (
                  <>
                    {content.backFormula && (
                      <p className="font-mono text-lg text-accent text-center mb-4">
                        {content.backFormula}
                      </p>
                    )}
                    <p className="text-text-secondary text-center text-sm leading-relaxed">
                      {content.backExplanation}
                    </p>
                  </>
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
      <div className="mt-6 pb-4">
        {flipped ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-2"
          >
            <Button variant="secondary" fullWidth size="lg" onClick={() => handleReview('again')}>
              Again
              <span className="text-xs text-text-muted font-normal">· in minutes</span>
            </Button>
            <Button fullWidth size="lg" onClick={() => handleReview('good')}>
              Good
              <span className="text-xs font-normal opacity-80">
                · {intervalLabel(preview?.good ?? 1)}
              </span>
            </Button>
            <Button variant="secondary" fullWidth size="lg" onClick={() => handleReview('easy')}>
              Easy
              <span className="text-xs text-text-muted font-normal">
                · {intervalLabel(preview?.easy ?? 4)}
              </span>
            </Button>
          </motion.div>
        ) : (
          <p className="text-center text-sm text-text-muted h-12 flex items-center justify-center">
            {lastScheduled !== null && reviewed > 0
              ? `Rescheduled ${intervalLabel(lastScheduled)} ✓`
              : 'Recall the answer, then tap the card to check yourself'}
          </p>
        )}
      </div>
    </div>
  );
};
