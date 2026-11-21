/**
 * Undo/redo over immutable snapshots. Each command stores the state before it; edits
 * that repeat the same `coalesce` key in quick succession (slider drags, typing) merge
 * into one step.
 */
export interface HistoryOptions {
  /** Maximum number of undo steps kept. Default 200. */
  readonly limit?: number;
  /** Edits with the same key within this many ms merge. Default 1000. */
  readonly coalesceMs?: number;
}

export class History<T> {
  #past: { state: T; label: string }[] = [];
  #future: { state: T; label: string }[] = [];
  #lastKey: string | undefined;
  #lastTime = 0;
  readonly #limit: number;
  readonly #coalesceMs: number;

  constructor(options: HistoryOptions = {}) {
    this.#limit = options.limit ?? 200;
    this.#coalesceMs = options.coalesceMs ?? 1000;
  }

  /**
   * Record that `before` is about to be replaced by a new state.
   * @param now the current time in ms (injectable for tests).
   */
  record(before: T, label: string, coalesce?: string, now = Date.now()): void {
    const merge =
      coalesce !== undefined &&
      coalesce === this.#lastKey &&
      now - this.#lastTime <= this.#coalesceMs &&
      this.#past.length > 0;
    this.#lastKey = coalesce;
    this.#lastTime = now;
    this.#future = [];
    if (merge) return;
    this.#past.push({ state: before, label });
    if (this.#past.length > this.#limit) this.#past.shift();
  }

  /** Step back: returns the state to restore, or undefined when there is nothing to undo. */
  undo(current: T): T | undefined {
    const step = this.#past.pop();
    if (!step) return undefined;
    this.#future.push({ state: current, label: step.label });
    this.#lastKey = undefined;
    return step.state;
  }

  redo(current: T): T | undefined {
    const step = this.#future.pop();
    if (!step) return undefined;
    this.#past.push({ state: current, label: step.label });
    this.#lastKey = undefined;
    return step.state;
  }

  /** Break coalescing so the next edit starts a new step. */
  seal(): void {
    this.#lastKey = undefined;
  }

  clear(): void {
    this.#past = [];
    this.#future = [];
    this.#lastKey = undefined;
  }

  get canUndo(): boolean {
    return this.#past.length > 0;
  }
  get canRedo(): boolean {
    return this.#future.length > 0;
  }
  /** Label of the step `undo` would revert. */
  get undoLabel(): string | undefined {
    return this.#past.at(-1)?.label;
  }
  get redoLabel(): string | undefined {
    return this.#future.at(-1)?.label;
  }
}
