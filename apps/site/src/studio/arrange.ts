/**
 * Multi-shape operations (PRD §8.5): groups, align, distribute and layer order. Pure
 * functions over item lists so they can be unit-tested; the store records history.
 *
 * Groups are flat: items that share a `group` id select, move, align and reorder as one
 * unit. Grouping keeps members next to each other in the layer order.
 */
import { itemBox, omit, type Box, type Item, type StudioDoc } from "./model.ts";
import { unionBox } from "./snap.ts";

export const ALIGN_EDGES = ["left", "hcenter", "right", "top", "vcenter", "bottom"] as const;
export type AlignEdge = (typeof ALIGN_EDGES)[number];
export type Axis = "x" | "y";
export type Order = "forward" | "backward" | "front" | "back";

const NO_BOX: Box = { x: 0, y: 0, w: 0, h: 0 };

/** A group (or a lone item) that moves as one. */
export interface Unit {
  readonly ids: readonly string[];
  readonly box: Box;
  readonly locked: boolean;
}

/** Every id in `ids` plus the other members of their groups. */
export function expandGroups(items: readonly Item[], ids: Iterable<string>): string[] {
  const set = new Set(ids);
  const groups = new Set(items.filter((i) => set.has(i.id) && i.group).map((i) => i.group));
  return items.filter((i) => set.has(i.id) || (i.group && groups.has(i.group))).map((i) => i.id);
}

/** The units of `items`: one per group, one per ungrouped item, in layer order. */
export function unitsOf(items: readonly Item[]): Unit[] {
  const byKey = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.group ? `g:${item.group}` : `i:${item.id}`;
    const list = byKey.get(key);
    if (list) list.push(item);
    else byKey.set(key, [item]);
  }
  return [...byKey.values()].map((members) => ({
    ids: members.map((m) => m.id),
    box: unionBox(members.map(itemBox)) ?? NO_BOX,
    locked: members.some((m) => m.locked),
  }));
}

/** Offsets that align the units of `items` to an edge of their combined box. */
export function align(
  items: readonly Item[],
  edge: AlignEdge,
): Map<string, { dx: number; dy: number }> {
  const units = unitsOf(items);
  const out = new Map<string, { dx: number; dy: number }>();
  if (units.length < 2) return out;
  const all = unionBox(units.map((u) => u.box)) ?? NO_BOX;
  for (const unit of units) {
    if (unit.locked) continue;
    const b = unit.box;
    let dx = 0;
    let dy = 0;
    if (edge === "left") dx = all.x - b.x;
    else if (edge === "right") dx = all.x + all.w - (b.x + b.w);
    else if (edge === "hcenter") dx = all.x + all.w / 2 - (b.x + b.w / 2);
    else if (edge === "top") dy = all.y - b.y;
    else if (edge === "bottom") dy = all.y + all.h - (b.y + b.h);
    else dy = all.y + all.h / 2 - (b.y + b.h / 2);
    if (dx !== 0 || dy !== 0) for (const id of unit.ids) out.set(id, { dx, dy });
  }
  return out;
}

/**
 * Offsets that space the units of `items` evenly along an axis: the first and last stay,
 * the gaps between neighbours become equal. Needs three units or more.
 */
export function distribute(
  items: readonly Item[],
  axis: Axis,
): Map<string, { dx: number; dy: number }> {
  const units = unitsOf(items);
  const out = new Map<string, { dx: number; dy: number }>();
  if (units.length < 3) return out;
  const pos = (b: Box) => (axis === "x" ? b.x : b.y);
  const len = (b: Box) => (axis === "x" ? b.w : b.h);
  const sorted = [...units].sort((a, b) => pos(a.box) - pos(b.box));
  const [first] = sorted;
  const last = sorted.at(-1);
  if (!first || !last) return out;
  const span = pos(last.box) + len(last.box) - pos(first.box);
  const gap = (span - sorted.reduce((sum, u) => sum + len(u.box), 0)) / (sorted.length - 1);
  let at = pos(first.box);
  for (const unit of sorted) {
    const d = at - pos(unit.box);
    at += len(unit.box) + gap;
    if (unit.locked || Math.abs(d) < 1e-9) continue;
    for (const id of unit.ids) out.set(id, axis === "x" ? { dx: d, dy: 0 } : { dx: 0, dy: d });
  }
  return out;
}

/** Runs of neighbouring items in layer order; a run is a group's contiguous members. */
function runs(items: readonly Item[]): Item[][] {
  const out: Item[][] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (prev && item.group && prev[0]?.group === item.group) prev.push(item);
    else out.push([item]);
  }
  return out;
}

/**
 * Change the layer order of the selected items (later items are drawn on top). Groups
 * move as one. Returns `items` unchanged when nothing moves.
 */
export function reorder(
  items: readonly Item[],
  ids: ReadonlySet<string>,
  op: Order,
): readonly Item[] {
  const blocks = runs(items);
  const picked = (b: Item[]) => b.some((i) => ids.has(i.id));
  let next: Item[][];
  if (op === "front") next = [...blocks.filter((b) => !picked(b)), ...blocks.filter(picked)];
  else if (op === "back") next = [...blocks.filter(picked), ...blocks.filter((b) => !picked(b))];
  else {
    next = [...blocks];
    const up = op === "forward";
    const order = next.map((_, i) => i);
    if (up) order.reverse();
    for (const i of order) {
      const j = up ? i + 1 : i - 1;
      const a = next[i];
      const b = next[j];
      if (a && b && picked(a) && !picked(b)) {
        next[i] = b;
        next[j] = a;
      }
    }
  }
  const flat = next.flat();
  return flat.every((item, i) => item === items[i]) ? items : flat;
}

/** The smallest group id not used in `doc`: `g1`, `g2`, ... */
export function nextGroupId(items: readonly Item[]): string {
  const used = new Set(items.map((i) => i.group));
  let n = 1;
  while (used.has(`g${String(n)}`)) n++;
  return `g${String(n)}`;
}

/**
 * Group the selected items under a new id, replacing any groups they were in, and gather
 * them just below the topmost selected item. Needs two items or more.
 */
export function group(doc: StudioDoc, ids: ReadonlySet<string>): StudioDoc {
  const picked = doc.items.filter((i) => ids.has(i.id));
  if (picked.length < 2) return doc;
  const id = nextGroupId(doc.items);
  const grouped = picked.map((i) => ({ ...i, group: id }));
  const top = doc.items.findLastIndex((i) => ids.has(i.id));
  const items: Item[] = [];
  doc.items.forEach((item, i) => {
    if (!ids.has(item.id)) items.push(item);
    if (i === top) items.push(...grouped);
  });
  return { ...doc, items };
}

/** Remove the selected items from their groups. */
export function ungroup(doc: StudioDoc, ids: ReadonlySet<string>): StudioDoc {
  if (!doc.items.some((i) => ids.has(i.id) && i.group)) return doc;
  return {
    ...doc,
    items: doc.items.map((i) => {
      if (!ids.has(i.id) || !i.group) return i;
      return omit(i, "group");
    }),
  };
}
