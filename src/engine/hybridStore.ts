import { AweSnapshot, ConceptMastery, EngineMeta, FlashcardState, QueueItem } from './types';
import {
  AWE_LOCAL_KEY,
  AweStore,
  lsReadJson,
  lsWriteJson,
  readLocalSnapshot,
  writeLocalSnapshot,
} from './store';
import { emptySnapshot, isEmptySnapshot, mergeSnapshots, migrateSnapshot } from './migrate';
import { getSupabase } from '@/services/supabase/client';
import { getExamUuid } from '@/services/taxonomy.service';

// ============================================================
// Hybrid AWE store: the engine reads and writes synchronously against an
// in-memory snapshot (it was designed around a sync store). Persistence is
// layered underneath:
//
//   · ephemeral → nothing persists (login screen, signed-out)
//   · local     → demo/explore, mirrored to localStorage
//   · supabase  → the user's awe_state row, PLUS a localStorage mirror
//
// The mirror is not redundancy for its own sake. The flush is debounced and a
// closing tab does not wait for it, so without a synchronous local write every
// tab close could lose the tail of a session. The mirror is replayed and merged
// on the next hydrate.
//
// Writes use optimistic concurrency on updated_at. A blind whole-blob upsert
// meant two tabs (or a phone and a laptop) silently erased each other's entire
// weakness history; on conflict we now re-read and merge instead.
// ============================================================

type Mode = 'ephemeral' | 'local' | 'supabase';

export type AweStoreError = 'hydrate_failed' | 'flush_failed';

const FLUSH_DELAY_MS = 500;
const FLUSH_MAX_WAIT_MS = 4000;
const MAX_PUSH_ATTEMPTS = 3;

const mirrorKey = (userId: string, examUuid: string) => `${AWE_LOCAL_KEY}:${userId}:${examUuid}`;

export class HybridAweStore implements AweStore {
  private snapshot: AweSnapshot = emptySnapshot();
  private mode: Mode = 'ephemeral';
  private userId: string | null = null;
  private examUuid: string | null = null;

  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private firstPendingAt: number | null = null;
  private pushInFlight: Promise<void> | null = null;
  private dirty = false;

  /** Baseline for optimistic concurrency — the updated_at we last saw. */
  private baseline: string | null = null;
  private hydrating = false;

  private lastError: AweStoreError | null = null;
  private errorListeners = new Set<(e: AweStoreError | null) => void>();

  constructor() {
    this.installUnloadFlush();
  }

  // ---- sync interface the engine uses ----

  getSnapshot(): AweSnapshot {
    return this.snapshot;
  }
  getMasteries() {
    return this.snapshot.masteries;
  }
  saveMasteries(m: Record<string, ConceptMastery>) {
    this.snapshot.masteries = m;
    this.onWrite();
  }
  getQueue() {
    return this.snapshot.queue;
  }
  saveQueue(q: QueueItem[]) {
    this.snapshot.queue = q;
    this.onWrite();
  }
  getFlashcards() {
    return this.snapshot.flashcards;
  }
  saveFlashcards(f: Record<string, FlashcardState>) {
    this.snapshot.flashcards = f;
    this.onWrite();
  }
  getMeta() {
    return this.snapshot.meta;
  }
  saveMeta(meta: EngineMeta) {
    this.snapshot.meta = meta;
    this.onWrite();
  }

  // ---- configuration (called on auth changes) ----

  /** Login screen / signed out: keep state in memory only. */
  configureEphemeral(): void {
    this.cancelFlush();
    this.mode = 'ephemeral';
    this.userId = null;
    this.examUuid = null;
    this.baseline = null;
    this.dirty = false;
    this.snapshot = emptySnapshot();
  }

  /** Demo/explore mode: load the localStorage state into the snapshot. */
  configureLocal(): void {
    this.cancelFlush();
    this.mode = 'local';
    this.userId = null;
    this.examUuid = null;
    this.baseline = null;
    this.dirty = false;
    this.snapshot = readLocalSnapshot();
  }

  /**
   * Signed-in mode: hydrate from the user's awe_state row.
   *
   * `mode` only flips to 'supabase' once we actually hold an exam uuid. Setting
   * it up front meant a failed lookup left every subsequent write silently
   * dropped for the whole session while the UI happily showed in-memory state.
   */
  async configureSupabase(userId: string, examSlug: string): Promise<void> {
    this.cancelFlush();
    this.userId = userId;
    this.baseline = null;
    this.dirty = false;
    this.hydrating = true;

    // Anything the engine writes while we are awaiting the network is merged in
    // rather than clobbered by the hydrated value.
    const pending = this.snapshot;
    const demoState = readLocalSnapshot();
    this.snapshot = emptySnapshot();

    try {
      const examUuid = await getExamUuid(examSlug);
      const mirror = migrateSnapshot(lsReadJson<unknown>(mirrorKey(userId, examUuid), null));

      const { data, error } = await getSupabase()
        .from('awe_state')
        .select('masteries, queue, flashcards, meta, updated_at')
        .eq('user_id', userId)
        .eq('exam_id', examUuid)
        .maybeSingle();
      if (error) throw error;

      const server = data ? migrateSnapshot(data) : emptySnapshot();
      this.baseline = (data?.updated_at as string | undefined) ?? null;

      // server ← unflushed local mirror ← writes that landed during hydration
      let merged = mergeSnapshots(server, mirror);
      if (!isEmptySnapshot(pending)) merged = mergeSnapshots(merged, pending);

      // First sign-in after exploring: adopt the demo progress rather than
      // dropping the user back to zero at the exact moment they convert.
      if (isEmptySnapshot(merged) && !isEmptySnapshot(demoState)) {
        merged = demoState;
        this.dirty = true;
      }

      this.snapshot = merged;
      this.examUuid = examUuid;
      this.mode = 'supabase';
      this.setError(null);

      if (this.dirty || !isEmptySnapshot(mirror) || !isEmptySnapshot(pending)) {
        this.dirty = true;
        this.scheduleFlush();
      }
    } catch {
      // Keep the user's work reachable and locally durable instead of pretending
      // to persist it. The next successful configure merges it upward.
      this.mode = 'local';
      this.examUuid = null;
      this.snapshot = isEmptySnapshot(pending) ? demoState : mergeSnapshots(demoState, pending);
      this.setError('hydrate_failed');
    } finally {
      this.hydrating = false;
    }
  }

  /** Force any pending write to persist now (e.g. before sign-out). */
  async flushNow(): Promise<void> {
    this.cancelFlush();
    this.mirrorLocally();
    if (this.mode !== 'supabase' || !this.dirty) return;
    await this.pushToSupabase();
  }

  // ---- error surfacing ----

  getLastError(): AweStoreError | null {
    return this.lastError;
  }

  onError(listener: (e: AweStoreError | null) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private setError(e: AweStoreError | null): void {
    if (this.lastError === e) return;
    this.lastError = e;
    for (const l of this.errorListeners) l(e);
  }

  // ---- internals ----

  private onWrite(): void {
    if (this.hydrating) return; // configureSupabase merges this snapshot itself
    this.dirty = true;
    this.mirrorLocally();
    if (this.mode === 'supabase') this.scheduleFlush();
  }

  /**
   * Synchronous local durability. Always runs, so a closed tab or a failed
   * network flush can never lose more than the current keystroke.
   */
  private mirrorLocally(): void {
    if (this.mode === 'local') writeLocalSnapshot(this.snapshot);
    else if (this.mode === 'supabase' && this.userId && this.examUuid) {
      lsWriteJson(mirrorKey(this.userId, this.examUuid), this.snapshot);
    }
  }

  private installUnloadFlush(): void {
    if (typeof window === 'undefined') return;
    const flush = () => {
      this.mirrorLocally();
      if (this.mode === 'supabase' && this.dirty) {
        this.cancelFlush();
        void this.pushToSupabase();
      }
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  private scheduleFlush(): void {
    const now = Date.now();
    if (this.firstPendingAt === null) this.firstPendingAt = now;

    // A burst of writes must not defer the flush indefinitely.
    if (now - this.firstPendingAt >= FLUSH_MAX_WAIT_MS) {
      this.cancelFlush();
      void this.pushToSupabase();
      return;
    }

    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.firstPendingAt = null;
      void this.pushToSupabase();
    }, FLUSH_DELAY_MS);
  }

  private cancelFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.firstPendingAt = null;
  }

  private async pushToSupabase(): Promise<void> {
    if (this.mode !== 'supabase' || !this.userId || !this.examUuid) return;
    // Serialise pushes so two in-flight writes can't race each other.
    if (this.pushInFlight) {
      await this.pushInFlight;
      if (!this.dirty) return;
    }
    this.pushInFlight = this.doPush().finally(() => {
      this.pushInFlight = null;
    });
    return this.pushInFlight;
  }

  private async doPush(): Promise<void> {
    const userId = this.userId;
    const examUuid = this.examUuid;
    if (!userId || !examUuid) return;

    for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt++) {
      const stamp = new Date().toISOString();
      const payload = {
        user_id: userId,
        exam_id: examUuid,
        masteries: this.snapshot.masteries,
        queue: this.snapshot.queue,
        flashcards: this.snapshot.flashcards,
        // The schema version rides inside the meta blob rather than a dedicated
        // column, so versioning needs no migration on an already-deployed table.
        meta: { ...this.snapshot.meta, version: this.snapshot.version },
        updated_at: stamp,
      };

      try {
        const supabase = getSupabase();

        if (this.baseline === null) {
          // No row observed yet — insert. A duplicate means someone else got
          // there first, which is a conflict, not a failure.
          const { error } = await supabase.from('awe_state').insert(payload);
          if (!error) {
            this.baseline = stamp;
            this.dirty = false;
            this.setError(null);
            return;
          }
          if (!this.isConflict(error)) throw error;
        } else {
          const { data, error } = await supabase
            .from('awe_state')
            .update(payload)
            .eq('user_id', userId)
            .eq('exam_id', examUuid)
            .eq('updated_at', this.baseline)
            .select('updated_at');
          if (error) throw error;
          if (data && data.length > 0) {
            this.baseline = stamp;
            this.dirty = false;
            this.setError(null);
            return;
          }
        }

        // Conflict: somebody else wrote since our baseline. Re-read, merge our
        // work on top, and try again rather than overwriting their session.
        const { data: fresh, error: readError } = await supabase
          .from('awe_state')
          .select('masteries, queue, flashcards, meta, updated_at')
          .eq('user_id', userId)
          .eq('exam_id', examUuid)
          .maybeSingle();
        if (readError) throw readError;

        const remote = fresh ? migrateSnapshot(fresh) : emptySnapshot();
        this.snapshot = mergeSnapshots(remote, this.snapshot);
        this.baseline = (fresh?.updated_at as string | undefined) ?? null;
        this.mirrorLocally();
      } catch {
        // Local mirror already holds this state; report it and let the next
        // write (or flushNow) retry rather than failing silently forever.
        this.setError('flush_failed');
        return;
      }
    }

    this.setError('flush_failed');
  }

  private isConflict(error: { code?: string } | null): boolean {
    return error?.code === '23505'; // unique_violation
  }
}
