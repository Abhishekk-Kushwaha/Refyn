import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { aweEngine } from '@/engine/engine';
import { FlashcardState } from '@/engine/types';
import { MockFlashcard } from '@/lib/mockFlashcards';
import { getFlashcardPool } from '@/services/flashcardPool';

interface DeckCard {
  state: FlashcardState;
  content: MockFlashcard;
  conceptName: string;
}

const intervalLabel = (days: number): string => {
  if (days <= 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  if (days < 60) return 'in 1 month';
  return 'in 2 months';
};

export const FlashcardsView = () => {
  const navigate = useNavigate();

  // Load the due deck once per mount; reviews mutate engine state, and we
  // advance through the local snapshot so the deck doesn't reshuffle mid-review.
  const initialDeck = useMemo<DeckCard[]>(() => {
    const conceptNames = new Map(aweEngine.getMasteries().map((m) => [m.conceptId, m.conceptName]));
    return aweEngine
      .getDueFlashcards()
      .map((state) => {
        const content = getFlashcardPool().find((c) => c.id === state.cardId);
        if (!content) return null;
        return {
          state,
          content,
          conceptName: conceptNames.get(state.conceptId) ?? state.conceptId,
        };
      })
      .filter((c): c is DeckCard => c !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [lastInterval, setLastInterval] = useState<number | null>(null);

  const card = initialDeck[index];
  const done = initialDeck.length > 0 && index >= initialDeck.length;
  const totalMaterialized = aweEngine.getFlashcardStates().length;

  const handleReview = (gotIt: boolean) => {
    if (!card) return;
    const next = aweEngine.reviewFlashcard(card.state.cardId, gotIt);
    setLastInterval(next.intervalDays);
    setReviewed((n) => n + 1);
    setFlipped(false);
    // small delay so the flip-back animation finishes before the next card slides in
    setTimeout(() => setIndex((i) => i + 1), 150);
  };

  // Nothing materialized yet — the engine only queues cards once a concept shows weakness.
  if (totalMaterialized === 0) {
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
  if (initialDeck.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="All caught up"
        description="No cards due for review right now — spaced repetition will bring them back exactly when you're about to forget."
        action={{ label: 'Practice Instead', onClick: () => navigate('/practice') }}
        className="flex-1"
      />
    );
  }

  // Finished today's due deck.
  if (done) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Deck cleared</h2>
          <p className="text-text-secondary mb-8">
            {reviewed} card{reviewed === 1 ? '' : 's'} reviewed. The engine has rescheduled each one
            based on how sure you were.
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

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col">
      {/* Header + progress */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <h1 className="text-2xl font-semibold text-text-primary">Flashcards</h1>
          <span className="text-sm text-text-muted font-mono">
            {index + 1} / {initialDeck.length}
          </span>
        </div>
        <p className="text-text-muted text-sm mb-3">Due today · weakest concepts first</p>
        <div className="w-full bg-border rounded-full h-1.5">
          <div
            className="bg-accent h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(index / initialDeck.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Flip card */}
      <div className="flex-1 flex flex-col justify-center" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={card.state.cardId}
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
                className="absolute inset-0 bg-surface rounded-lg shadow-lg border border-border flex flex-col items-center justify-center p-8"
              >
                <span className="text-xs font-semibold text-accent bg-accent-subtle px-2 py-1 rounded-full mb-4">
                  {card.conceptName}
                </span>
                <p className="text-xl text-text-primary text-center font-medium leading-relaxed">
                  {card.content.front}
                </p>
                <p className="text-xs text-text-muted mt-6">✋ Tap to reveal</p>
              </div>

              {/* Back */}
              <div
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                className="absolute inset-0 bg-surface-raised rounded-lg shadow-lg border border-accent flex flex-col items-center justify-center p-8"
              >
                {card.content.backFormula && (
                  <p className="font-mono text-lg text-accent text-center mb-4">
                    {card.content.backFormula}
                  </p>
                )}
                <p className="text-text-secondary text-center text-sm leading-relaxed">
                  {card.content.backExplanation}
                </p>
              </div>
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Review actions — only after the reveal, so "Got it" means something */}
      <div className="mt-6 pb-4">
        {flipped ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
            <Button variant="secondary" fullWidth size="lg" onClick={() => handleReview(false)}>
              Not sure
              <span className="text-xs text-text-muted font-normal">· see it tomorrow</span>
            </Button>
            <Button fullWidth size="lg" onClick={() => handleReview(true)}>
              Got it
              <span className="text-xs font-normal opacity-80">
                · {intervalLabel(
                  card.state.consecutiveCorrect + 1 >= 3
                    ? [3, 7, 14, 30, 60][Math.min(card.state.consecutiveCorrect - 2, 4)]
                    : Math.max(1, Math.round(card.state.intervalDays * card.state.easeFactor))
                )}
              </span>
            </Button>
          </motion.div>
        ) : (
          <p className="text-center text-sm text-text-muted h-12 flex items-center justify-center">
            {lastInterval !== null && reviewed > 0
              ? `Rescheduled ${intervalLabel(lastInterval)} ✓`
              : 'Recall the answer, then tap the card to check yourself'}
          </p>
        )}
      </div>
    </div>
  );
};
