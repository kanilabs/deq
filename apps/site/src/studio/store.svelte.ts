/**
 * Studio state: the document with undo/redo, the selection, the view and the overlays.
 * Every document change goes through {@link Studio.commit}, which records history.
 */
import { DEFAULT_OPTIONS, prepare } from "@0xdolan/deq-core";

import {
  align,
  distribute,
  expandGroups,
  group,
  nextGroupId,
  reorder,
  ungroup,
  unitsOf,
  type AlignEdge,
  type Axis,
  type Order,
} from "./arrange.ts";
import {
  CUSTOM_LIMITS,
  CustomShapeError,
  fromSpecJson,
  isCustomId,
  parseCustomDef,
  type CustomDef,
} from "./custom.ts";
import type { ShapeStore } from "./db.ts";
import { History } from "./history.ts";
import {
  DocError,
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
  embedShapes,
  omit,
} from "./model.ts";
import { knownShape, setCustomShapes, shapeOf } from "./shapes.ts";
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
  #doc = $state<StudioDoc>(EMPTY_DOC);
  /** "My shapes": custom shapes saved in this browser. */
  library = $state<readonly CustomDef[]>([]);
  /** Whether the library survives a reload (IndexedDB is available). */
  persistent = $state(false);
  #shapeStore: ShapeStore | undefined;
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

  get doc(): StudioDoc {
    return this.#doc;
  }
  set doc(next: StudioDoc) {
    const changed = next.shapes !== this.#doc.shapes;
    this.#doc = next;
    if (changed) this.#syncShapes();
  }

  /** Tell the renderers about the custom shapes in play (the design's copies win). */
  #syncShapes(): void {
    setCustomShapes(this.library, this.#doc.shapes ?? []);
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
    next = embedShapes(next, (id) => this.customDef(id));
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

  /** Add a catalog or custom shape centred on (cx, cy) in canvas px, or the viewport centre. */
  add(
    shape: string,
    label: string,
    at?: { x: number; y: number },
    viewport?: { w: number; h: number },
  ): Item | undefined {
    if (this.doc.items.length >= LIMITS.items) return undefined;
    if (isCustomId(shape) ? !this.customDef(shape) : !knownShape(shape)) return undefined;
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
    const groups = new Map<string, string>();
    for (const item of this.doc.items) {
      if (!set.has(item.id) || doc.items.length >= LIMITS.items) continue;
      let copy: Item = {
        ...omit(item, "locked"),
        id: nextId(doc),
        x: item.x + GRID * 2,
        y: item.y + GRID * 2,
      };
      if (item.group) {
        const g = groups.get(item.group) ?? nextGroupId(doc.items);
        groups.set(item.group, g);
        copy = { ...copy, group: g };
      }
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
    return this.#patch(ids, () => patch, label, coalesce);
  }

  /** Apply a per-item option patch to unlocked items, after core accepts every result. */
  #patch(
    ids: readonly string[],
    patchOf: (item: Item) => Partial<ItemOptions>,
    label: string,
    coalesce?: string,
  ): string | undefined {
    const set = new Set(ids);
    const items = this.doc.items.filter((i) => set.has(i.id) && !i.locked);
    const next = new Map<string, ItemOptions>();
    for (const item of items) {
      const options = { ...item.options, ...patchOf(item) };
      try {
        prepare(shapeOf(item.shape), options);
      } catch (error) {
        return (error as Error).message;
      }
      next.set(item.id, compactOptions(options));
    }
    if (items.length === 0) return undefined;
    this.commit(
      this.#map(new Set(next.keys()), (i) => ({ ...i, options: next.get(i.id) ?? i.options })),
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

  /** Set a shape parameter on items (all of the same shape in the inspector). */
  setParam(
    ids: readonly string[],
    name: string,
    value: number | boolean | string,
    label: string,
  ): string | undefined {
    return this.#patch(
      ids,
      (i) => ({ params: { ...i.options.params, [name]: value } }),
      label,
      `param:${ids.join(",")}:${name}`,
    );
  }

  resetParam(ids: readonly string[], name: string, label: string): void {
    const set = new Set(ids);
    if (!this.doc.items.some((i) => set.has(i.id) && i.options.params && name in i.options.params))
      return;
    this.#patch(ids, (i) => ({ params: omit(i.options.params ?? {}, name) }), label);
  }

  setLayerColor(
    ids: readonly string[],
    layer: string,
    color: string | undefined,
    label: string,
  ): string | undefined {
    return this.#patch(
      ids,
      (i) => {
        const rest = omit(i.options.layerColors ?? {}, layer);
        return { layerColors: color === undefined ? rest : { ...rest, [layer]: color } };
      },
      label,
      `layer:${ids.join(",")}:${layer}`,
    );
  }

  // Arrange (Phase 8b) -----------------------------------------------------------------

  /** Number of units (groups or lone items) in the selection. */
  get units(): number {
    return unitsOf(this.selected).length;
  }

  #offset(moves: ReadonlyMap<string, { dx: number; dy: number }>, label: string): void {
    if (moves.size === 0) return;
    this.commit(
      this.#map(new Set(moves.keys()), (i) => {
        const m = moves.get(i.id) ?? { dx: 0, dy: 0 };
        return { ...i, x: i.x + m.dx, y: i.y + m.dy };
      }),
      label,
    );
  }

  align(edge: AlignEdge, label: string): void {
    this.#offset(align(this.selected, edge), label);
  }

  distribute(axis: Axis, label: string): void {
    this.#offset(distribute(this.selected, axis), label);
  }

  /** Change the layer order of `ids` (the selection by default). */
  arrange(order: Order, label: string, ids: readonly string[] = this.selection): void {
    const items = reorder(this.doc.items, new Set(ids), order);
    if (items !== this.doc.items) this.commit({ ...this.doc, items }, label);
  }

  group(label: string): void {
    this.commit(group(this.doc, new Set(this.selection)), label);
  }

  ungroup(label: string): void {
    this.commit(ungroup(this.doc, new Set(this.selection)), label);
  }

  /** Set a flag on items; `undefined` toggles: on unless every item already has it. */
  setFlag(ids: readonly string[], flag: "locked" | "hidden", label: string, value?: boolean): void {
    const set = new Set(ids);
    const items = this.doc.items.filter((i) => set.has(i.id));
    if (items.length === 0) return;
    const on = value ?? !items.every((i) => i[flag]);
    this.commit(
      this.#map(set, (i) => (on ? { ...i, [flag]: true } : omit(i, flag))),
      label,
    );
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

  /** Select an item and its group; `additive` toggles them in the selection. */
  select(id: string, additive = false): void {
    const ids = expandGroups(this.doc.items, [id]);
    if (!additive) this.selection = ids;
    else if (this.selection.includes(id))
      this.selection = this.selection.filter((s) => !ids.includes(s));
    else this.selection = expandGroups(this.doc.items, [...this.selection, ...ids]);
  }
  /** Select these items and their groups (marquee); `additive` adds to the selection. */
  selectIds(ids: readonly string[], additive = false): void {
    this.selection = expandGroups(this.doc.items, additive ? [...this.selection, ...ids] : ids);
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

  // Custom shapes (Phase 8c) ----------------------------------------------------------

  /** The definition of custom shape `id`: the design's copy, else the library's. */
  customDef(id: string): CustomDef | undefined {
    return this.doc.shapes?.find((d) => d.id === id) ?? this.library.find((d) => d.id === id);
  }

  /** Load "My shapes" from `store`, or keep them in memory when it is missing or fails. */
  async useShapeStore(store: ShapeStore | undefined): Promise<void> {
    let rows: CustomDef[] = [];
    try {
      rows = store ? await store.all() : [];
      this.#shapeStore = store;
    } catch {
      this.#shapeStore = undefined;
    }
    this.persistent = this.#shapeStore !== undefined;
    const ids = new Set(this.library.map((d) => d.id));
    this.library = [...this.library, ...rows.filter((d) => !ids.has(d.id))].slice(
      0,
      CUSTOM_LIMITS.shapes,
    );
    this.#syncShapes();
  }

  /**
   * Save `def` to the library. When the design uses the shape, its embedded copy is
   * updated too, as one undoable step. @throws CustomShapeError when the library is full.
   */
  async saveCustom(def: CustomDef, label: string): Promise<void> {
    const valid = parseCustomDef(def);
    const at = this.library.findIndex((d) => d.id === valid.id);
    if (at < 0 && this.library.length >= CUSTOM_LIMITS.shapes) {
      throw new CustomShapeError(`at most ${String(CUSTOM_LIMITS.shapes)} custom shapes`);
    }
    this.library =
      at < 0 ? [...this.library, valid] : this.library.map((d, i) => (i === at ? valid : d));
    this.#syncShapes();
    const shapes = this.doc.shapes;
    if (shapes?.some((d) => d.id === valid.id)) {
      this.commit(
        { ...this.doc, shapes: shapes.map((d) => (d.id === valid.id ? valid : d)) },
        label,
      );
    }
    await this.#persist((store) => store.put(valid));
  }

  /** Remove custom shape `id` from the library. Designs keep their embedded copy. */
  async deleteCustom(id: string): Promise<void> {
    this.library = this.library.filter((d) => d.id !== id);
    this.#syncShapes();
    await this.#persist((store) => store.delete(id));
  }

  /** Import a spec JSON file into the library. @throws CustomShapeError on bad input. */
  async importCustom(text: string, label = "import"): Promise<CustomDef> {
    const def = fromSpecJson(text, (id) => this.customDef(id) !== undefined);
    await this.saveCustom(def, label);
    return def;
  }

  /** Replace the design with `next` (an opened file or a share link), as one undoable step. */
  openDoc(next: StudioDoc, label: string): void {
    this.selection = [];
    this.commit(next, label);
  }

  /**
   * Open a JSON file: a design replaces the current one, a shape in the spec format joins
   * "My shapes". @throws DocError or CustomShapeError on bad input.
   */
  async openJson(text: string, label: string): Promise<"design" | CustomDef> {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new DocError("invalid design: not JSON");
    }
    if (value !== null && typeof value === "object" && "items" in value) {
      this.openDoc(parseDoc(value), label);
      return "design";
    }
    return this.importCustom(text, label);
  }

  /** What an export covers: the selected items, else every visible one, in drawing order. */
  get exportable(): Item[] {
    return this.selection.length > 0 ? this.selected : this.doc.items.filter((i) => !i.hidden);
  }

  async #persist(write: (store: ShapeStore) => Promise<void>): Promise<void> {
    if (!this.#shapeStore) return;
    try {
      await write(this.#shapeStore);
    } catch {
      // Storage failed (quota, private mode): keep the library in memory for the session.
      this.#shapeStore = undefined;
      this.persistent = false;
    }
  }

  // Persistence (a per-browser convenience; share links are in share.ts) ----------------

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
