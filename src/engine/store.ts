import { ConceptMastery, EngineMeta, FlashcardState, QueueItem } from './types';

// Storage behind an interface (Doc 5 §12 Stage B). The engine only ever talks
// to AweStore — Phase 1 swaps LocalStorageAweStore for a Supabase adapter and
// the rules never notice.

export interface AweStore {
  getMasteries(): Record<string, ConceptMastery>;
  saveMasteries(masteries: Record<string, ConceptMastery>): void;
  getQueue(): QueueItem[];
  saveQueue(queue: QueueItem[]): void;
  getFlashcards(): Record<string, FlashcardState>;
  saveFlashcards(cards: Record<string, FlashcardState>): void;
  getMeta(): EngineMeta;
  saveMeta(meta: EngineMeta): void;
}

const KEYS = {
  masteries: 'refyn-awe-mastery',
  queue: 'refyn-awe-queue',
  flashcards: 'refyn-awe-flashcards',
  meta: 'refyn-awe-meta',
} as const;

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — engine still works in-memory for the session
  }
};

export class LocalStorageAweStore implements AweStore {
  getMasteries(): Record<string, ConceptMastery> {
    return read(KEYS.masteries, {});
  }
  saveMasteries(masteries: Record<string, ConceptMastery>): void {
    write(KEYS.masteries, masteries);
  }
  getQueue(): QueueItem[] {
    return read(KEYS.queue, []);
  }
  saveQueue(queue: QueueItem[]): void {
    write(KEYS.queue, queue);
  }
  getFlashcards(): Record<string, FlashcardState> {
    return read(KEYS.flashcards, {});
  }
  saveFlashcards(cards: Record<string, FlashcardState>): void {
    write(KEYS.flashcards, cards);
  }
  getMeta(): EngineMeta {
    return read(KEYS.meta, { examDate: null, reviewsDue: {}, lastDailyTick: null });
  }
  saveMeta(meta: EngineMeta): void {
    write(KEYS.meta, meta);
  }
}

/** In-memory store — used by unit tests so they never touch localStorage. */
export class MemoryAweStore implements AweStore {
  private masteries: Record<string, ConceptMastery> = {};
  private queue: QueueItem[] = [];
  private flashcards: Record<string, FlashcardState> = {};
  private meta: EngineMeta = { examDate: null, reviewsDue: {}, lastDailyTick: null };

  getMasteries() {
    return this.masteries;
  }
  saveMasteries(m: Record<string, ConceptMastery>) {
    this.masteries = m;
  }
  getQueue() {
    return this.queue;
  }
  saveQueue(q: QueueItem[]) {
    this.queue = q;
  }
  getFlashcards() {
    return this.flashcards;
  }
  saveFlashcards(f: Record<string, FlashcardState>) {
    this.flashcards = f;
  }
  getMeta() {
    return this.meta;
  }
  saveMeta(m: EngineMeta) {
    this.meta = m;
  }
}
