/**
 * Studio state: the document with undo/redo, the selection, the view and the overlays.
 * Every document change goes through {@link Studio.commit}, which records history.
 */
import { DEFAULT_OPTIONS, getShape, prepare } from "@0xdolan/deq-core";

import { History } from "./history.ts";
import {
  EMPTY_DOC,
  LIMITS,
  compactOptions,
  itemBox,
  nextId,
  parseDoc,
  type Item,
  type ItemOptions,
  type OptionKey,
  type StudioDoc,
  omit,
} from "./model.ts";
import { GRID, ZOOM, clampZoom, fitView, unionBox, zoomAt, type View } from "./snap.ts";

const DOC_KEY = "deq-studio-doc";
const PREFS_KEY = "deq-studio-prefs";

export interface Overlays {
  grid: boolean;
  keylines: boolean;
  pixels: boolean;
  rulers: boolean;
  snap: boolean;
}

type Storage_ = Pick<Storage, "getItem" | "setItem">;

function safeStorage(): Storage_ | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export class Studio {
  doc = $state<StudioDoc>(EMPTY_DOC);
  selection = $state<string[]>([]);
  view = $state<View>({ x: -40, y: -40, zoom: 4 });
  overlays = $state<Overlays>({
    grid: true,
    keylines: false,
    pixels: false,
    rulers: true,
    snap: true,
  });
  /** The last message for the screen-reader live region. */
  announcement = $state("");
  /** Bumped on undo/redo so derived UI (labels, buttons) refreshes. */
  #tick = $state(0);
  readonly history = new History<StudioDoc>();
  readonly #storage: Storage_ | undefined;

  constructor(storage: Storage_ | undefined = safeStorage()) {
    this.#storage = storage;
  }

  get selected(): Item[] {
    const ids = new Set(this.selection);
    return this.doc.items.filter((i) => ids.has(i.id));
  }
  /** The single selected item, if exactly one is selected. */
  get current(): Item | undefined {
    const s = this.selected;
    return s.length === 1 ? s[0] : undefined;
  }
  get canUndo(): boolean {
    return this.#tick >= 0 && this.history.canUndo;
  }
  get canRedo(): boolean {
    return this.#tick >= 0 && this.history.canRedo;
  }

  announce(message: string): void {
    // Re-set so the same message is announced twice in a row.
    this.announcement = "";
    queueMicrotask(() => (this.announcement = message));
  }

  /** Replace the document, recording the previous one for undo. */
  commit(next: StudioDoc, label: string, coalesce?: string): void {
    if (next === this.doc) return;
    this.history.record(this.doc, label, coalesce);
    this.doc = next;
    this.#tick++;
    this.#save();
  }

  /** Replace the document without history (live drag preview). */
  preview(next: StudioDoc): void {
    this.doc = next;
  }

  /** Finish a live preview: record `before` for undo, or drop it if nothing changed. */
  commitPreview(before: StudioDoc, label: string): void {
    if (before === this.doc) return;
    this.history.record(before, label);
    this.#tick++;
    this.#save();
  }

  undo(): string | undefined {
    const label = this.history.undoLabel;
    const prev = this.history.undo(this.doc);
    if (!prev) return undefined;
    this.doc = prev;
    this.#pruneSelection();
    this.#tick++;
    this.#save();
    return label;
  }

  redo(): string | undefined {
    const label = this.history.redoLabel;
    const next = this.history.redo(this.doc);
    if (!next) return undefined;
    this.doc = next;
    this.#pruneSelection();
    this.#tick++;
    this.#save();
    return label;
  }

  #pruneSelection(): void {
    const ids = new Set(this.doc.items.map((i) => i.id));
    this.selection = this.selection.filter((id) => ids.has(id));
  }

  #map(ids: ReadonlySet<string>, fn: (item: Item) => Item): StudioDoc {
    return { ...this.doc, items: this.doc.items.map((i) => (ids.has(i.id) ? fn(i) : i)) };
  }

  // Items ------------------------------------------------------------------------------

  /** Add a catalog shape centred on (cx, cy) in canvas px, or the viewport centre. */
  add(
    shape: string,
    label: string,
    at?: { x: number; y: number },
    viewport?: { w: number; h: number },
  ): Item | undefined {
    if (this.doc.items.length >= LIMITS.items) return undefined;
    getShape(shape);
    const size = DEFAULT_OPTIONS.size;
    const centre =
      at ??
      (viewport
        ? {
            x: this.view.x + viewport.w / 2 / this.view.zoom,
            y: this.view.y + viewport.h / 2 / this.view.zoom,
          }
        : { x: size / 2, y: size / 2 });
    const snap = (n: number) => (this.overlays.snap ? Math.round(n / GRID) * GRID : n);
    let x = snap(centre.x - size / 2);
    const y = snap(centre.y - size / 2);
    // Do not stack a new shape exactly on top of another one.
    for (let n = 0; n < 50 && this.doc.items.some((i) => i.x === x && i.y === y); n++) {
      x += size + GRID;
    }
    const item: Item = { id: nextId(this.doc), shape, x, y, options: {} };
    this.commit({ ...this.doc, items: [...this.doc.items, item] }, label);
    this.selection = [item.id];
    return item;
  }

  remove(ids: readonly string[], label: string): void {
    const set = new Set(ids);
    const items = this.doc.items.filter((i) => !set.has(i.id) || i.locked);
    if (items.length === this.doc.items.length) return;
    this.commit({ ...this.doc, items }, label);
    this.#pruneSelection();
  }

  duplicate(ids: readonly string[], label: string): void {
    const set = new Set(ids);
    let doc = this.doc;
    const copies: string[] = [];
    for (const item of this.doc.items) {
      if (!set.has(item.id) || doc.items.length >= LIMITS.items) continue;
      const copy: Item = { ...item, id: nextId(doc), x: item.x + GRID * 2, y: item.y + GRID * 2 };
      delete (copy as { locked?: boolean }).locked;
      doc = { ...doc, items: [...doc.items, copy] };
      copies.push(copy.id);
    }
    if (copies.length === 0) return;
    this.commit(doc, label);
    this.selection = copies;
  }

  /** Move items by (dx, dy). Locked items stay put. */
  moveBy(ids: readonly string[], dx: number, dy: number, label: string, coalesce?: string): void {
    if (dx === 0 && dy === 0) return;
    const set = new Set(ids);
    const clamp = (n: number) => Math.max(-LIMITS.coordinate, Math.min(LIMITS.coordinate, n));
    this.commit(
      this.#map(set, (i) => (i.locked ? i : { ...i, x: clamp(i.x + dx), y: clamp(i.y + dy) })),
      label,
      coalesce,
    );
  }

  /**
   * Set an option on items, checked by core for each item's shape.
   * @returns the error message when the value is rejected.
   */
  setOptions(
    ids: readonly string[],
    patch: Partial<ItemOptions>,
    label: string,
    coalesce?: string,
  ): string | undefined {
    const set = new Set(ids);
    const items = this.doc.items.filter((i) => set.has(i.id) && !i.locked);
    for (const item of items) {
      try {
        prepare(getShape(item.shape), { ...item.options, ...patch });
      } catch (error) {
        return (error as Error).message;
      }
    }
    if (items.length === 0) return undefined;
    this.commit(
      this.#map(new Set(items.map((i) => i.id)), (i) => ({
        ...i,
        options: compactOptions({ ...i.options, ...patch }),
      })),
      label,
      coalesce,
    );
    return undefined;
  }

  resetOption(
    ids: readonly string[],
    key: OptionKey | "params" | "layerColors",
    label: string,
  ): void {
    const set = new Set(ids);
    if (!this.doc.items.some((i) => set.has(i.id) && !i.locked && key in i.options)) return;
    this.commit(
      this.#map(set, (i) => {
        if (i.locked) return i;
        return { ...i, options: omit(i.options, key) };
      }),
      label,
    );
  }

  /** Reset every option of the given items ("reset shape"). */
  resetItems(ids: readonly string[], label: string): void {
    const set = new Set(ids);
    if (
      !this.doc.items.some((i) => set.has(i.id) && !i.locked && Object.keys(i.options).length > 0)
    )
      return;
    this.commit(
      this.#map(set, (i) => (i.locked ? i : { ...i, options: {} })),
      label,
    );
  }

  setParam(
    id: string,
    name: string,
    value: number | boolean | string,
    label: string,
  ): string | undefined {
    const item = this.doc.items.find((i) => i.id === id);
    if (!item) return undefined;
    return this.setOptions(
      [id],
      { params: { ...item.options.params, [name]: value } },
      label,
      `param:${id}:${name}`,
    );
  }

  resetParam(id: string, name: string, label: string): void {
    const item = this.doc.items.find((i) => i.id === id);
    if (!item?.options.params || !(name in item.options.params)) return;
    this.setOptions([id], { params: omit(item.options.params, name) }, label);
  }

  setLayerColor(
    id: string,
    layer: string,
    color: string | undefined,
    label: string,
  ): string | undefined {
    const item = this.doc.items.find((i) => i.id === id);
    if (!item) return undefined;
    const rest = omit(item.options.layerColors ?? {}, layer);
    const layerColors = color === undefined ? rest : { ...rest, [layer]: color };
    return this.setOptions([id], { layerColors }, label, `layer:${id}:${layer}`);
  }

  setName(id: string, name: string, label: string): void {
    const trimmed = name.slice(0, LIMITS.name);
    this.commit(
      this.#map(new Set([id]), (i) => {
        const rest = omit(i, "name");
        return trimmed ? { ...rest, name: trimmed } : rest;
      }),
      label,
      `name:${id}`,
    );
  }

  // Selection --------------------------------------------------------------------------

  select(id: string, additive = false): void {
    if (!additive) this.selection = [id];
    else if (this.selection.includes(id)) this.selection = this.selection.filter((s) => s !== id);
    else this.selection = [...this.selection, id];
  }
  selectAll(): void {
    this.selection = this.doc.items.filter((i) => !i.hidden).map((i) => i.id);
  }
  deselect(): void {
    this.selection = [];
  }

  // View -------------------------------------------------------------------------------

  zoomBy(factor: number, sx: number, sy: number): void {
    this.view = zoomAt(this.view, this.view.zoom * factor, sx, sy);
  }
  zoomTo(zoom: number, w: number, h: number): void {
    this.view = zoomAt(this.view, clampZoom(zoom), w / 2, h / 2);
  }
  zoomIn(w: number, h: number): void {
    this.zoomBy(ZOOM.step, w / 2, h / 2);
  }
  zoomOut(w: number, h: number): void {
    this.zoomBy(1 / ZOOM.step, w / 2, h / 2);
  }
  /** Fit the selection, or every item, into the viewport. */
  fit(w: number, h: number): void {
    const items = this.selected.length > 0 ? this.selected : this.doc.items;
    const box = unionBox(items.map(itemBox)) ?? { x: 0, y: 0, w: 24, h: 24 };
    this.view = fitView(box, w, h);
  }
  panBy(dx: number, dy: number): void {
    this.view = {
      ...this.view,
      x: this.view.x - dx / this.view.zoom,
      y: this.view.y - dy / this.view.zoom,
    };
  }

  toggle(key: keyof Overlays): void {
    this.overlays = { ...this.overlays, [key]: !this.overlays[key] };
    this.#savePrefs();
  }

  // Persistence (a per-browser convenience; shared links come in Phase 8d) ------------

  /** Restore the autosaved document and preferences. Bad data is ignored. */
  load(): void {
    try {
      const raw = this.#storage?.getItem(DOC_KEY);
      if (raw) this.doc = parseDoc(JSON.parse(raw) as unknown);
    } catch {
      this.doc = EMPTY_DOC;
    }
    try {
      const raw = this.#storage?.getItem(PREFS_KEY);
      const prefs = raw ? (JSON.parse(raw) as unknown) : undefined;
      if (prefs && typeof prefs === "object") {
        const next = { ...this.overlays };
        for (const key of Object.keys(next) as (keyof Overlays)[]) {
          const val = (prefs as Record<string, unknown>)[key];
          if (typeof val === "boolean") next[key] = val;
        }
        this.overlays = next;
      }
    } catch {
      // Keep the defaults.
    }
  }

  #save(): void {
    try {
      this.#storage?.setItem(DOC_KEY, JSON.stringify(this.doc));
    } catch {
      // Storage full or unavailable: the session keeps working without autosave.
    }
  }

  #savePrefs(): void {
    try {
      this.#storage?.setItem(PREFS_KEY, JSON.stringify(this.overlays));
    } catch {
      // As above.
    }
  }
}
