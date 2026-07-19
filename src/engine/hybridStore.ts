import { ConceptMastery, EngineMeta, FlashcardState, QueueItem } from './types';
import { AweStore } from './store';
import { getSupabase } from '@/services/supabase/client';
import { getExamUuid } from '@/services/taxonomy.service';

// Hybrid AWE store: the engine reads and writes synchronously against an
// in-memory cache (it was designed around a sync store and is verified as such).
// Persistence is layered underneath the cache:
//   · demo mode      → mirror every write to localStorage synchronously
//   · signed-in mode → hydrate the cache from the awe_state blob row on login,
//     then debounce-flush the whole state back on writes (fire-and-forget)
//
// This keeps the engine untouched while giving real accounts durable,
// cross-device weakness state.

type Mode = 'local' | 'supabase';

interface AweCache {
  masteries: Record<string, ConceptMastery>;
  queue: QueueItem[];
  flashcards: Record<string, FlashcardState>;
  meta: EngineMeta;
}

const emptyMeta = (): EngineMeta => ({ examDate: null, reviewsDue: {}, lastDailyTick: null });

const emptyCache = (): AweCache => ({
  masteries: {},
  queue: [],
  flashcards: {},
  meta: emptyMeta(),
});

const LS_KEYS = {
  masteries: 'refyn-awe-mastery',
  queue: 'refyn-awe-queue',
  flashcards: 'refyn-awe-flashcards',
  meta: 'refyn-awe-meta',
} as const;

const lsRead = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const lsWrite = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable — engine still works in-memory for the session
  }
};

const FLUSH_DELAY_MS = 800;

export class HybridAweStore implements AweStore {
  private cache: AweCache = emptyCache();
  private mode: Mode = 'local';
  private userId: string | null = null;
  private examUuid: string | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- sync interface the engine uses ----

  getMasteries() {
    return this.cache.masteries;
  }
  saveMasteries(m: Record<string, ConceptMastery>) {
    this.cache.masteries = m;
    if (this.mode === 'local') lsWrite(LS_KEYS.masteries, m);
    else this.scheduleFlush();
  }
  getQueue() {
    return this.cache.queue;
  }
  saveQueue(q: QueueItem[]) {
    this.cache.queue = q;
    if (this.mode === 'local') lsWrite(LS_KEYS.queue, q);
    else this.scheduleFlush();
  }
  getFlashcards() {
    return this.cache.flashcards;
  }
  saveFlashcards(f: Record<string, FlashcardState>) {
    this.cache.flashcards = f;
    if (this.mode === 'local') lsWrite(LS_KEYS.flashcards, f);
    else this.scheduleFlush();
  }
  getMeta() {
    return this.cache.meta;
  }
  saveMeta(m: EngineMeta) {
    this.cache.meta = m;
    if (this.mode === 'local') lsWrite(LS_KEYS.meta, m);
    else this.scheduleFlush();
  }

  // ---- configuration (called on auth changes) ----

  /** Demo/explore mode: load the localStorage state into the cache. */
  configureLocal(): void {
    this.cancelFlush();
    this.mode = 'local';
    this.userId = null;
    this.examUuid = null;
    this.cache = {
      masteries: lsRead(LS_KEYS.masteries, {}),
      queue: lsRead(LS_KEYS.queue, []),
      flashcards: lsRead(LS_KEYS.flashcards, {}),
      meta: lsRead(LS_KEYS.meta, emptyMeta()),
    };
  }

  /** Signed-in mode: hydrate the cache from the user's awe_state blob row. */
  async configureSupabase(userId: string, examSlug: string): Promise<void> {
    this.cancelFlush();
    this.mode = 'supabase';
    this.userId = userId;
    this.cache = emptyCache();

    try {
      this.examUuid = await getExamUuid(examSlug);
      const { data } = await getSupabase()
        .from('awe_state')
        .select('masteries, queue, flashcards, meta')
        .eq('user_id', userId)
        .eq('exam_id', this.examUuid)
        .maybeSingle();

      if (data) {
        this.cache = {
          masteries: (data.masteries as Record<string, ConceptMastery>) ?? {},
          queue: (data.queue as QueueItem[]) ?? [],
          flashcards: (data.flashcards as Record<string, FlashcardState>) ?? {},
          meta: { ...emptyMeta(), ...((data.meta as Partial<EngineMeta>) ?? {}) },
        };
      }
    } catch {
      // Offline / not seeded yet — start empty; the first write will create the row.
    }
  }

  /** Force any pending write to persist now (e.g. before sign-out). */
  async flushNow(): Promise<void> {
    if (this.mode !== 'supabase') return;
    this.cancelFlush();
    await this.pushToSupabase();
  }

  // ---- internals ----

  private scheduleFlush(): void {
    this.cancelFlush();
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.pushToSupabase();
    }, FLUSH_DELAY_MS);
  }

  private cancelFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async pushToSupabase(): Promise<void> {
    if (this.mode !== 'supabase' || !this.userId || !this.examUuid) return;
    try {
      await getSupabase()
        .from('awe_state')
        .upsert(
          {
            user_id: this.userId,
            exam_id: this.examUuid,
            masteries: this.cache.masteries,
            queue: this.cache.queue,
            flashcards: this.cache.flashcards,
            meta: this.cache.meta,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,exam_id' }
        );
    } catch {
      // Best-effort; the cache remains authoritative for the session and the
      // next write will retry the flush.
    }
  }
}
