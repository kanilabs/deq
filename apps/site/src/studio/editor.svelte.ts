/**
 * The shape editor's draft (Phase 8c): the parts of a custom shape with their own
 * undo/redo and selection. Every change is validated like a saved shape (spec ranges,
 * core's expansion limits) and refused when it would break the shape.
 */
import type { Primitive, Vec } from "@0xdolan/deq-core";

import { booleanOp, BooleanError, type BoolErrorCode, type BoolOp } from "./boolean.ts";
import {
  CUSTOM_LIMITS,
  CustomShapeError,
  newCustomId,
  parseCustomDef,
  type CustomDef,
} from "./custom.ts";
import {
  MID,
  reflectPrimitive,
  rotation,
  scaling,
  toPaths,
  transformPrimitive,
  translation,
  type Axis,
  type Similarity,
} from "./geometry.ts";
import { History } from "./history.ts";

/** Parts the editor can add, with their starting geometry on the 24-unit grid. */
export const PART_KINDS = ["line", "circle", "rect", "polygon", "path", "arc", "dot"] as const;
export type PartKind = (typeof PART_KINDS)[number];

export function newPart(kind: PartKind): Primitive {
  switch (kind) {
    case "line":
      return { type: "line", x1: 6, y1: 12, x2: 18, y2: 12 };
    case "circle":
      return { type: "circle", cx: 12, cy: 12, r: 6 };
    case "rect":
      return { type: "rect", x: 6, y: 6, width: 12, height: 12 };
    case "polygon":
      return {
        type: "polygon",
        points: [
          [12, 5],
          [19, 18],
          [5, 18],
        ],
      };
    case "path":
      return { type: "path", d: "M5 16 C8 6 16 6 19 16" };
    case "arc":
      return { type: "arc", cx: 12, cy: 12, r: 6, start: 180, end: 360 };
    case "dot":
      return { type: "dot", cx: 12, cy: 12 };
  }
}

export interface DraftState {
  readonly name: string;
  readonly primitives: readonly Primitive[];
}

/** A user-facing reason an edit was refused. */
export type EditError = "invalid" | "limit" | BoolErrorCode;

export class ShapeDraft {
  readonly id: string;
  readonly #baseVersion: number;
  readonly #initial: DraftState;
  state = $state<DraftState>({ name: "", primitives: [] });
  selection = $state<number[]>([]);
  #tick = $state(0);
  readonly history = new History<DraftState>();

  constructor(def?: CustomDef, makeId: () => string = newCustomId) {
    this.id = def?.id ?? makeId();
    this.#baseVersion = def?.version ?? 0;
    this.state = { name: def?.name ?? "", primitives: def?.primitives ?? [] };
    this.#initial = this.state;
  }

  get primitives(): readonly Primitive[] {
    return this.state.primitives;
  }
  get isNew(): boolean {
    return this.#baseVersion === 0;
  }
  /** Selected part indices, bottom first. */
  get selected(): number[] {
    return [...this.selection].sort((a, b) => a - b);
  }
  get current(): Primitive | undefined {
    const [only, ...more] = this.selection;
    return only !== undefined && more.length === 0 ? this.primitives[only] : undefined;
  }
  get canUndo(): boolean {
    return this.#tick >= 0 && this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.#tick >= 0 && this.history.canRedo;
  }
  get dirty(): boolean {
    return this.#tick >= 0 && this.state !== this.#initial;
  }

  /** Is this list of parts a valid shape (an empty draft is fine)? */
  check(primitives: readonly Primitive[]): EditError | undefined {
    if (primitives.length > CUSTOM_LIMITS.primitives) return "limit";
    if (primitives.length === 0) return undefined;
    try {
      parseCustomDef({ id: this.id, version: 1, name: "draft", primitives });
      return undefined;
    } catch {
      return "invalid";
    }
  }

  /** Replace the parts after validating them. @returns why the edit was refused. */
  commit(
    primitives: readonly Primitive[],
    label: string,
    selection?: number[],
    coalesce?: string,
  ): EditError | undefined {
    const error = this.check(primitives);
    if (error) return error;
    this.history.record(this.state, label, coalesce);
    this.state = { ...this.state, primitives };
    if (selection) this.selection = selection;
    this.#pruneSelection();
    this.#tick++;
    return undefined;
  }

  /** Show parts without history or validation (live drag). */
  preview(primitives: readonly Primitive[]): void {
    this.state = { ...this.state, primitives };
  }

  /** Finish a drag: keep it if valid (recording `before`), otherwise roll back. */
  commitPreview(before: DraftState, label: string): EditError | undefined {
    if (before === this.state || before.primitives === this.state.primitives) return undefined;
    const error = this.check(this.state.primitives);
    if (error) {
      this.state = before;
      return error;
    }
    this.history.record(before, label);
    this.#tick++;
    return undefined;
  }

  /** Live drag: show `before` with the selected parts moved by (dx, dy). */
  previewMove(before: DraftState, dx: number, dy: number): void {
    const sel = new Set(this.selection);
    const t = translation(dx, dy);
    // Translation never bakes a part, so indices and the selection stay the same.
    this.preview(
      before.primitives.map((p, i) => (sel.has(i) ? (transformPrimitive(p, t)[0] ?? p) : p)),
    );
  }

  setName(name: string, label: string): void {
    const trimmed = name.slice(0, CUSTOM_LIMITS.name);
    if (trimmed === this.state.name) return;
    this.history.record(this.state, label, "name");
    this.state = { ...this.state, name: trimmed };
    this.#tick++;
  }

  undo(): string | undefined {
    const label = this.history.undoLabel;
    const prev = this.history.undo(this.state);
    if (!prev) return undefined;
    this.state = prev;
    this.#pruneSelection();
    this.#tick++;
    return label;
  }

  redo(): string | undefined {
    const label = this.history.redoLabel;
    const next = this.history.redo(this.state);
    if (!next) return undefined;
    this.state = next;
    this.#pruneSelection();
    this.#tick++;
    return label;
  }

  #pruneSelection(): void {
    const n = this.primitives.length;
    const kept = this.selection.filter((i) => i < n);
    if (kept.length !== this.selection.length) this.selection = kept;
  }

  // Selection ---------------------------------------------------------------------------

  select(i: number, additive = false): void {
    if (i < 0 || i >= this.primitives.length) {
      if (!additive) this.selection = [];
      return;
    }
    if (!additive) this.selection = [i];
    else if (this.selection.includes(i)) this.selection = this.selection.filter((k) => k !== i);
    else this.selection = [...this.selection, i];
  }
  selectAll(): void {
    this.selection = this.primitives.map((_, i) => i);
  }
  deselect(): void {
    this.selection = [];
  }

  // Edits -------------------------------------------------------------------------------

  /** Replace the selected parts (bottom first) by what `fn` returns for each. */
  #mapSelected(
    fn: (prim: Primitive) => Primitive[],
    label: string,
    coalesce?: string,
  ): EditError | undefined {
    const sel = new Set(this.selection);
    if (sel.size === 0) return undefined;
    const out: Primitive[] = [];
    const selection: number[] = [];
    this.primitives.forEach((prim, i) => {
      if (!sel.has(i)) {
        out.push(prim);
        return;
      }
      for (const p of fn(prim)) {
        selection.push(out.length);
        out.push(p);
      }
    });
    return this.commit(out, label, selection, coalesce);
  }

  add(prim: Primitive, label: string): EditError | undefined {
    return this.commit([...this.primitives, prim], label, [this.primitives.length]);
  }

  /** Replace one part (inspector edits). */
  update(i: number, prim: Primitive, label: string, coalesce?: string): EditError | undefined {
    if (!this.primitives[i]) return undefined;
    return this.commit(
      this.primitives.map((p, k) => (k === i ? prim : p)),
      label,
      undefined,
      coalesce,
    );
  }

  remove(label: string): EditError | undefined {
    const sel = new Set(this.selection);
    if (sel.size === 0) return undefined;
    return this.commit(
      this.primitives.filter((_, i) => !sel.has(i)),
      label,
      [],
    );
  }

  duplicate(label: string): EditError | undefined {
    const copies = this.selected.flatMap((i) => {
      const p = this.primitives[i];
      return p ? [p] : [];
    });
    if (copies.length === 0) return undefined;
    const n = this.primitives.length;
    return this.commit(
      [...this.primitives, ...copies],
      label,
      copies.map((_, k) => n + k),
    );
  }

  /** Move the selected parts one step up (towards the top) or down the stack. */
  reorder(dir: "up" | "down", label: string): EditError | undefined {
    const sel = new Set(this.selection);
    if (sel.size === 0) return undefined;
    const order = this.primitives.map((_, i) => i);
    const step = dir === "up" ? 1 : -1;
    // Walk from the end the parts move towards, so a blocked part blocks the ones behind it.
    const positions = dir === "up" ? [...order].reverse() : [...order];
    for (const pos of positions) {
      const k = order[pos] ?? -1;
      const other = order[pos + step];
      if (!sel.has(k) || other === undefined || sel.has(other)) continue;
      order[pos] = other;
      order[pos + step] = k;
    }
    if (order.every((k, i) => k === i)) return undefined;
    const out = order.flatMap((k) => this.primitives.slice(k, k + 1));
    return this.commit(
      out,
      label,
      order.flatMap((k, i) => (sel.has(k) ? [i] : [])),
    );
  }

  transform(t: Similarity, label: string, coalesce?: string): EditError | undefined {
    return this.#mapSelected((p) => transformPrimitive(p, t), label, coalesce);
  }
  move(dx: number, dy: number, label: string, coalesce?: string): EditError | undefined {
    return this.transform(translation(dx, dy), label, coalesce);
  }
  rotate(deg: number, label: string, center: Vec = [MID, MID]): EditError | undefined {
    return this.transform(rotation(deg, center), label);
  }
  scale(k: number, label: string, center: Vec = [MID, MID]): EditError | undefined {
    return this.transform(scaling(k, center), label);
  }

  /** Mirror the selected parts across the grid's centre line, or add mirrored copies. */
  mirror(axis: Axis, copy: boolean, label: string): EditError | undefined {
    if (!copy) return this.#mapSelected((p) => reflectPrimitive(p, axis), label);
    const mirrored = this.selected.flatMap((i) => {
      const p = this.primitives[i];
      return p ? reflectPrimitive(p, axis) : [];
    });
    if (mirrored.length === 0) return undefined;
    const n = this.primitives.length;
    return this.commit(
      [...this.primitives, ...mirrored],
      label,
      mirrored.map((_, k) => n + k),
    );
  }

  /** Wrap each selected part in a rotate-array (radial) or a repeat. */
  wrap(kind: "radial" | "repeat", label: string): EditError | undefined {
    return this.#mapSelected(
      (element) =>
        kind === "radial"
          ? [{ type: "radial", count: 6, center: [MID, MID], start: 0, sweep: 360, element }]
          : [{ type: "repeat", count: 3, step: [4, 0], align: "center", element }],
      label,
    );
  }

  /** Take the element back out of selected arrays. */
  unwrap(label: string): EditError | undefined {
    if (!this.selected.some((i) => "element" in (this.primitives[i] ?? {}))) return undefined;
    return this.#mapSelected((p) => ("element" in p ? [p.element] : [p]), label);
  }

  /** Bake the selected parts into paths (dots stay dots). */
  toPath(label: string): EditError | undefined {
    if (this.selected.every((i) => this.primitives[i]?.type === "path")) return undefined;
    return this.#mapSelected((p) => (p.type === "path" ? [p] : toPaths(p)), label);
  }

  /** Combine the selected parts with a boolean operation into one path. */
  async boolean(op: BoolOp, label: string): Promise<EditError | undefined> {
    const sel = this.selected;
    if (sel.length < 2) return "count";
    const parts = sel.flatMap((i) => this.primitives.slice(i, i + 1));
    const snapshot = this.primitives;
    let result: Primitive;
    try {
      result = await booleanOp(op, parts);
    } catch (error) {
      if (error instanceof BooleanError) return error.code;
      throw error;
    }
    // The parts may have changed while paper.js loaded.
    if (this.primitives !== snapshot) return undefined;
    const first = sel[0] ?? 0;
    const drop = new Set(sel);
    const out = snapshot.flatMap((p, i) => (i === first ? [result] : drop.has(i) ? [] : [p]));
    return this.commit(out, label, [out.indexOf(result)]);
  }

  /** The definition to save; the version goes up when an existing shape changed. */
  toDef(fallbackName: string): CustomDef {
    const name = this.state.name.trim() || fallbackName;
    const changed = this.state !== this.#initial;
    const version = Math.max(1, this.#baseVersion + (changed || this.isNew ? 1 : 0));
    try {
      return parseCustomDef({ id: this.id, version, name, primitives: this.primitives });
    } catch (error) {
      if (error instanceof CustomShapeError) throw error;
      throw new CustomShapeError((error as Error).message);
    }
  }
}
