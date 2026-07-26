import { AweSnapshot, ConceptMastery, EngineMeta, FlashcardState, QueueItem } from './types';
import { emptySnapshot, migrateSnapshot } from './migrate';

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
  /** Whole-state read, for migration/merge/diagnostics. */
  getSnapshot(): AweSnapshot;
}

/** Current single-blob key. */
export const AWE_LOCAL_KEY = 'refyn-awe-state';

/** v1 wrote four separate keys; read them once so nobody loses their history. */
const LEGACY_KEYS = {
  masteries: 'refyn-awe-mastery',
  queue: 'refyn-awe-queue',
  flashcards: 'refyn-awe-flashcards',
  meta: 'refyn-awe-meta',
} as const;

export const lsReadJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const lsWriteJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable / quota — the engine still works in-memory
  }
};

/** Read the local snapshot at `key`, absorbing the v1 four-key layout if present. */
export const readLocalSnapshot = (key: string = AWE_LOCAL_KEY): AweSnapshot => {
  const stored = lsReadJson<unknown>(key, null);
  if (stored !== null) return migrateSnapshot(stored);

  const legacy = {
    masteries: lsReadJson(LEGACY_KEYS.masteries, {}),
    queue: lsReadJson(LEGACY_KEYS.queue, []),
    flashcards: lsReadJson(LEGACY_KEYS.flashcards, {}),
    meta: lsReadJson(LEGACY_KEYS.meta, {}),
  };
  return migrateSnapshot(legacy);
};

export const writeLocalSnapshot = (snapshot: AweSnapshot, key: string = AWE_LOCAL_KEY): void =>
  lsWriteJson(key, snapshot);

/** Snapshot-backed store — one implementation, three persistence behaviours. */
abstract class SnapshotStore implements AweStore {
  protected snapshot: AweSnapshot = emptySnapshot();

  getSnapshot(): AweSnapshot {
    return this.snapshot;
  }

  getMasteries() {
    return this.snapshot.masteries;
  }
  saveMasteries(m: Record<string, ConceptMastery>) {
    this.snapshot.masteries = m;
    this.persist();
  }
  getQueue() {
    return this.snapshot.queue;
  }
  saveQueue(q: QueueItem[]) {
    this.snapshot.queue = q;
    this.persist();
  }
  getFlashcards() {
    return this.snapshot.flashcards;
  }
  saveFlashcards(f: Record<string, FlashcardState>) {
    this.snapshot.flashcards = f;
    this.persist();
  }
  getMeta() {
    return this.snapshot.meta;
  }
  saveMeta(meta: EngineMeta) {
    this.snapshot.meta = meta;
    this.persist();
  }

  protected abstract persist(): void;
}

export class LocalStorageAweStore extends SnapshotStore {
  constructor(private key: string = AWE_LOCAL_KEY) {
    super();
    this.snapshot = readLocalSnapshot(key);
  }
  protected persist(): void {
    writeLocalSnapshot(this.snapshot, this.key);
  }
}

/** In-memory store — used by unit tests so they never touch localStorage. */
export class MemoryAweStore extends SnapshotStore {
  protected persist(): void {
    // nothing to do
  }
}
