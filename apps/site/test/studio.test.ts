import { getShape, listShapes } from "@0xdolan/deq-core";
import { describe, expect, it } from "vitest";

import { CATALOGS } from "../src/i18n/index.ts";
import {
  align,
  distribute,
  expandGroups,
  group,
  nextGroupId,
  reorder,
  ungroup,
  unitsOf,
} from "../src/studio/arrange.ts";
import { History } from "../src/studio/history.ts";
import { studioMessages, translator } from "../src/studio/i18n.ts";
import {
  DocError,
  EMPTY_DOC,
  compactOptions,
  itemBox,
  nextId,
  optionValue,
  parseDoc,
  renderOptions,
  type Item,
  type ItemOptions,
} from "../src/studio/model.ts";
import { renderCached } from "../src/studio/render.ts";
import { normalize, searchShapes } from "../src/studio/search.ts";
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  actionFor,
  comboOf,
  diffBindings,
  displayCombo,
  loadBindings,
  mergeBindings,
  rebind,
  saveBindings,
} from "../src/studio/shortcuts.ts";
import {
  GRID,
  ZOOM,
  clampZoom,
  fitView,
  rulerStep,
  rulerTicks,
  snapBox,
  toCanvas,
  unionBox,
  zoomAt,
} from "../src/studio/snap.ts";
import { Studio } from "../src/studio/store.svelte.ts";

const item = (over: Partial<Item> = {}): Item => ({
  id: "i1",
  shape: "kurdish-sun",
  x: 0,
  y: 0,
  options: {},
  ...over,
});

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

describe("model", () => {
  it("parses a valid document and compacts default options", () => {
    const doc = parseDoc({
      v: 1,
      items: [
        {
          id: "i1",
          shape: "kurdish-sun",
          x: 1,
          y: 2,
          options: { size: 24, color: "#c00" },
          name: "Sun",
        },
      ],
    });
    expect(doc.items[0]).toEqual({
      id: "i1",
      shape: "kurdish-sun",
      x: 1,
      y: 2,
      options: { color: "#c00" },
      name: "Sun",
    });
  });

  it("keeps locked and hidden flags", () => {
    const doc = parseDoc({ v: 1, items: [{ ...item(), locked: true, hidden: true }] });
    expect(doc.items[0]).toMatchObject({ locked: true, hidden: true });
  });

  it.each([
    [null, "invalid design"],
    [{ v: 2, items: [] }, "v"],
    [{ v: 1, items: [{ ...item(), shape: "nope" }] }, "unknown shape"],
    [{ v: 1, items: [{ ...item(), x: Number.POSITIVE_INFINITY }] }, "items.0.x"],
    [{ v: 1, items: [item(), item()] }, "duplicate id"],
    [{ v: 1, items: [{ ...item(), options: { title: "x" } }] }, "title and ariaLabel"],
    [{ v: 1, items: [{ ...item(), options: { color: "url(#x)" } }] }, "items.0.options"],
    [{ v: 1, items: [{ ...item(), options: { params: { nope: 1 } } }] }, "items.0.options"],
    [{ v: 1, items: [{ ...item(), extra: 1 }] }, "invalid design"],
  ])("rejects %j", (value, message) => {
    expect(() => parseDoc(value)).toThrow(DocError);
    expect(() => parseDoc(value)).toThrow(message);
  });

  it("caps the number of items", () => {
    const items = Array.from({ length: 501 }, (_, i) => item({ id: `i${String(i)}` }));
    expect(() => parseDoc({ v: 1, items })).toThrow(DocError);
  });

  it("compacts options", () => {
    expect(
      compactOptions({
        size: 24,
        color: "red",
        params: {},
        layerColors: {},
        rotation: undefined,
      } as unknown as ItemOptions),
    ).toEqual({
      color: "red",
    });
    expect(compactOptions({ params: { rays: 9 }, layerColors: { rays: "red" } })).toEqual({
      params: { rays: 9 },
      layerColors: { rays: "red" },
    });
  });

  it("reads option values, render options, ids and boxes", () => {
    const it1 = item({ options: { size: 48 } });
    expect(optionValue(it1, "size")).toBe(48);
    expect(optionValue(it1, "linecap")).toBe("round");
    expect(renderOptions(it1).title).toBe(getShape("kurdish-sun").names.en);
    expect(renderOptions({ ...it1, name: "Mine" }, { size: 16 })).toMatchObject({
      title: "Mine",
      size: 16,
    });
    expect(itemBox(it1)).toEqual({ x: 0, y: 0, w: 48, h: 48 });
    expect(nextId(EMPTY_DOC)).toBe("i1");
    expect(nextId({ v: 1, items: [item({ id: "i1" }), item({ id: "i3" })] })).toBe("i2");
    expect(nextId({ v: 1, items: [item({ id: "i1" }), item({ id: "i2" })] })).toBe("i3");
  });
});

describe("history", () => {
  it("undoes, redoes and caps steps", () => {
    const h = new History<number>({ limit: 2 });
    expect(h.undo(0)).toBeUndefined();
    expect(h.redo(0)).toBeUndefined();
    h.record(0, "a");
    h.record(1, "b");
    h.record(2, "c");
    expect(h.undoLabel).toBe("c");
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeUndefined();
    expect(h.canRedo).toBe(true);
    expect(h.redoLabel).toBe("b");
    expect(h.redo(1)).toBe(2);
    h.record(2, "d");
    expect(h.canRedo).toBe(false);
    h.clear();
    expect(h.canUndo).toBe(false);
  });

  it("coalesces edits with the same key in time", () => {
    const h = new History<number>({ coalesceMs: 100 });
    h.record(0, "a", "k", 0);
    h.record(1, "a", "k", 50);
    h.record(2, "a", "k", 300);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(0);
    h.record(5, "x", "k", 0);
    h.seal();
    h.record(6, "x", "k", 1);
    expect(h.undo(7)).toBe(6);
  });
});

describe("search", () => {
  const shapes = listShapes();
  it("normalises diacritics and Arabic-script variants", () => {
    expect(normalize(" Stêrk ")).toBe("sterk");
    expect(normalize("كي")).toBe("کی");
  });
  it("finds by name, alias and tag, filters by category", () => {
    expect(searchShapes(shapes, "").length).toBe(shapes.length);
    const sun = searchShapes(shapes, "sun");
    expect(sun.length).toBeGreaterThan(1);
    const top = sun[0];
    expect(top && (top.id.startsWith("sun") || top.names.en.toLowerCase().startsWith("sun"))).toBe(
      true,
    );
    const cat = shapes[0]?.category ?? "";
    expect(searchShapes(shapes, "", cat).every((s) => s.category === cat)).toBe(true);
    expect(searchShapes(shapes, "zzzzzz")).toEqual([]);
    expect(searchShapes(shapes, "sun", "", new Map()).length).toBe(sun.length);
  });
  it("finds Kurdish names", () => {
    const named = shapes.find((s) => s.names.kmr.text);
    if (named?.names.kmr.text) expect(searchShapes(shapes, named.names.kmr.text)).toContain(named);
  });
});

describe("snap and view", () => {
  it("zooms about a point and converts coordinates", () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, 2, 100, 100);
    expect(v).toEqual({ x: 50, y: 50, zoom: 2 });
    expect(toCanvas(v, 100, 100)).toEqual({ x: 100, y: 100 });
    expect(clampZoom(1000)).toBe(ZOOM.max);
    expect(clampZoom(0)).toBe(ZOOM.min);
  });
  it("fits boxes and unions them", () => {
    expect(unionBox([])).toBeUndefined();
    const u = unionBox([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 20, y: 5, w: 10, h: 10 },
    ]);
    expect(u).toEqual({ x: 0, y: 0, w: 30, h: 15 });
    const f = fitView({ x: 0, y: 0, w: 100, h: 100 }, 296, 296, 48);
    expect(f.zoom).toBe(2);
    expect(f.x).toBeCloseTo(-24);
  });
  it("snaps to other boxes, then to the grid", () => {
    const other = { x: 100, y: 100, w: 24, h: 24 };
    const s = snapBox({ x: 97, y: 30, w: 24, h: 24 }, [other], 5);
    expect(s.x).toBe(100);
    expect(s.guides.v).toEqual([100]);
    expect(s.y).toBe(32);
    expect(s.guides.h).toEqual([]);
    const centre = snapBox({ x: 0, y: 86, w: 48, h: 48 }, [other], 5);
    expect(centre.y).toBe(88);
    expect(snapBox({ x: 3.3, y: 3.3, w: 1, h: 1 }, [], 1, 0).x).toBe(3.3);
    expect(GRID).toBe(8);
  });
  it("picks ruler steps and ticks", () => {
    expect(rulerStep(1)).toBe(100);
    expect(rulerStep(4)).toBe(20);
    expect(rulerStep(30)).toBe(2);
    expect(rulerStep(1, 50)).toBe(50);
    expect(rulerTicks(-15, 50, 10)).toEqual([-10, 0, 10, 20, 30]);
  });
});

describe("shortcuts", () => {
  const ev = (
    key: string,
    mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {},
  ) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });
  it("builds combos", () => {
    expect(comboOf(ev("z", { ctrlKey: true }), false)).toBe("Mod+Z");
    expect(comboOf(ev("z", { metaKey: true, shiftKey: true }), true)).toBe("Mod+Shift+Z");
    expect(comboOf(ev("z", { ctrlKey: true }), true)).toBe("Ctrl+Z");
    expect(comboOf(ev("?", { shiftKey: true }), false)).toBe("?");
    expect(comboOf(ev("ArrowLeft", { shiftKey: true, altKey: true }), false)).toBe(
      "Shift+Alt+ArrowLeft",
    );
    expect(comboOf(ev(" "), false)).toBe("Space");
    expect(comboOf(ev("Shift", { shiftKey: true }), false)).toBeUndefined();
  });
  it("finds actions, respecting text fields", () => {
    expect(actionFor(DEFAULT_BINDINGS, ev("z", { ctrlKey: true }), false, true)).toBe("undo");
    expect(actionFor(DEFAULT_BINDINGS, ev("g"), false, true)).toBeUndefined();
    expect(actionFor(DEFAULT_BINDINGS, ev("g"), false, false)).toBe("toggleGrid");
    expect(actionFor(DEFAULT_BINDINGS, ev("q"), false, false)).toBeUndefined();
    expect(actionFor(DEFAULT_BINDINGS, ev("Alt"), false, false)).toBeUndefined();
  });
  it("rebinds, diffs, merges and displays", () => {
    const next = rebind(DEFAULT_BINDINGS, "toggleGrid", "Mod+Z");
    expect(next.toggleGrid).toEqual(["Mod+Z"]);
    expect(next.undo).toEqual([]);
    expect(diffBindings(next)).toEqual({ toggleGrid: ["Mod+Z"], undo: [] });
    expect(
      mergeBindings({ toggleGrid: ["X", 3, "", "y".repeat(40)], bogus: ["A"], undo: "nope" })
        .toggleGrid,
    ).toEqual(["X"]);
    expect(mergeBindings(null)).toEqual(DEFAULT_BINDINGS);
    expect(displayCombo("Mod+Shift+Z", true)).toBe("⌘ShiftZ");
    expect(displayCombo("Mod+Z", false)).toBe("Ctrl+Z");
    expect(ACTIONS.every((a) => Array.isArray(DEFAULT_BINDINGS[a]))).toBe(true);
  });
  it("loads and saves overrides, tolerating broken storage", () => {
    const s = new MemoryStorage();
    expect(loadBindings(s)).toEqual(DEFAULT_BINDINGS);
    saveBindings(s, rebind(DEFAULT_BINDINGS, "help", "H"));
    expect(loadBindings(s).help).toEqual(["H"]);
    saveBindings(s, DEFAULT_BINDINGS);
    expect(s.data.size).toBe(0);
    s.setItem("deq-studio-shortcuts", "{bad json");
    expect(loadBindings(s)).toEqual(DEFAULT_BINDINGS);
    const broken = {
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("full");
      },
    };
    expect(() => {
      saveBindings(broken, DEFAULT_BINDINGS);
    }).not.toThrow();
    expect(loadBindings(undefined)).toEqual(DEFAULT_BINDINGS);
  });
});

describe("i18n and render", () => {
  it("picks Studio keys and fills placeholders", () => {
    const m = studioMessages(CATALOGS.en);
    expect(Object.keys(m).every((k) => k.startsWith("studio.") || k.startsWith("category."))).toBe(
      true,
    );
    const t = translator(m);
    expect(t("studio.results", { count: 3 })).toBe("3 shapes");
    expect(t("studio.add")).toBe("Add {name} to the canvas");
    for (const locale of ["ckb", "kmr"] as const)
      expect(Object.keys(studioMessages(CATALOGS[locale]))).toEqual(Object.keys(m));
  });
  it("caches renders", () => {
    const a = renderCached("kurdish-sun", { size: 32 });
    expect(renderCached("kurdish-sun", { size: 32 })).toBe(a);
    expect(a).toContain('width="32"');
    for (let i = 0; i < 2001; i++) renderCached("kurdish-sun", { size: 1 + (i % 4000) });
    expect(renderCached("kurdish-sun", { size: 32 })).toBe(a);
  });
});

describe("arrange", () => {
  // Default size is 24, so each box is 24 px square.
  const a = item({ id: "a", x: 0, y: 0 });
  const b = item({ id: "b", x: 50, y: 10 });
  const c = item({ id: "c", x: 200, y: 100 });
  const ids = (list: readonly Item[]) => list.map((i) => i.id).join("");

  it("expands groups and builds units", () => {
    const list = [a, { ...b, group: "g1" }, { ...c, group: "g1" }];
    expect(expandGroups(list, ["b"])).toEqual(["b", "c"]);
    expect(expandGroups(list, ["a"])).toEqual(["a"]);
    const units = unitsOf([...list, { ...a, id: "d", locked: true }]);
    expect(units.map((u) => u.ids)).toEqual([["a"], ["b", "c"], ["d"]]);
    expect(units[1]?.box).toEqual({ x: 50, y: 10, w: 174, h: 114 });
    expect(units[2]?.locked).toBe(true);
    expect(nextGroupId(list)).toBe("g2");
    expect(nextGroupId([a])).toBe("g1");
  });

  it("aligns units to every edge and skips locked ones", () => {
    const list = [a, b, c];
    expect(align([a], "left").size).toBe(0);
    expect(align(list, "left").get("b")).toEqual({ dx: -50, dy: 0 });
    expect(align(list, "left").has("a")).toBe(false);
    expect(align(list, "right").get("a")).toEqual({ dx: 200, dy: 0 });
    expect(align(list, "hcenter").get("a")).toEqual({ dx: 100, dy: 0 });
    expect(align(list, "top").get("c")).toEqual({ dx: 0, dy: -100 });
    expect(align(list, "bottom").get("a")).toEqual({ dx: 0, dy: 100 });
    expect(align(list, "vcenter").get("a")).toEqual({ dx: 0, dy: 50 });
    expect(align([{ ...a, locked: true }, b], "left").size).toBe(1);
    // A group moves as one.
    const grouped = align([a, { ...b, group: "g1" }, { ...c, group: "g1" }], "left");
    expect(grouped.get("b")).toEqual({ dx: -50, dy: 0 });
    expect(grouped.get("c")).toEqual({ dx: -50, dy: 0 });
  });

  it("distributes three units or more", () => {
    expect(distribute([a, b], "x").size).toBe(0);
    // Span 0..224, boxes 72, gap (224-72)/2 = 76: b moves to x=100.
    expect(distribute([c, b, a], "x").get("b")).toEqual({ dx: 50, dy: 0 });
    expect(distribute([a, b, c], "y").get("b")).toEqual({ dx: 0, dy: 40 });
    expect(distribute([a, { ...b, locked: true }, c], "x").size).toBe(0);
    expect(distribute([a, { ...b, x: 100 }, c], "x").size).toBe(0);
  });

  it("reorders blocks and keeps groups together", () => {
    const d = item({ id: "d" });
    const list = [a, b, c, d];
    expect(ids(reorder(list, new Set(["a"]), "front"))).toBe("bcda");
    expect(ids(reorder(list, new Set(["d"]), "back"))).toBe("dabc");
    expect(ids(reorder(list, new Set(["a", "c"]), "forward"))).toBe("badc");
    expect(ids(reorder(list, new Set(["b", "d"]), "backward"))).toBe("badc");
    expect(reorder(list, new Set(["d"]), "forward")).toBe(list);
    expect(reorder(list, new Set(["a"]), "back")).toBe(list);
    const g = [a, { ...b, group: "g1" }, { ...c, group: "g1" }, d];
    expect(ids(reorder(g, new Set(["a"]), "forward"))).toBe("bcad");
    expect(ids(reorder(g, new Set(["b", "c"]), "front"))).toBe("adbc");
  });

  it("groups and ungroups", () => {
    const d = item({ id: "d" });
    const doc = { v: 1 as const, items: [a, b, c, d] };
    expect(group(doc, new Set(["a"]))).toBe(doc);
    const grouped = group(doc, new Set(["a", "c"]));
    expect(ids(grouped.items)).toBe("bacd");
    expect(grouped.items.filter((i) => i.group === "g1")).toHaveLength(2);
    expect(ungroup(doc, new Set(["a"]))).toBe(doc);
    const back = ungroup(grouped, new Set(["a"]));
    expect(back.items.find((i) => i.id === "a")?.group).toBeUndefined();
    expect(back.items.find((i) => i.id === "c")?.group).toBe("g1");
  });
});

describe("store", () => {
  const studio = (storage = new MemoryStorage()) => ({ s: new Studio(storage), storage });

  it("adds, moves, edits, undoes and autosaves", () => {
    const { s, storage } = studio();
    const a = s.add("kurdish-sun", "Add");
    expect(a).toBeDefined();
    expect(s.selection).toEqual([a?.id]);
    expect(s.current?.id).toBe(a?.id);
    const b = s.add("kurdish-sun", "Add", { x: 12, y: 12 });
    expect(b?.x).not.toBe(a?.x);
    const c = s.add("kurdish-sun", "Add", undefined, { w: 800, h: 600 });
    expect(c).toBeDefined();
    expect(s.doc.items).toHaveLength(3);
    expect(
      (JSON.parse(storage.getItem("deq-studio-doc") ?? "{}") as { items: unknown[] }).items,
    ).toHaveLength(3);

    s.moveBy([a?.id ?? ""], 5, 5, "Move");
    s.moveBy([a?.id ?? ""], 0, 0, "Move");
    expect(s.doc.items[0]?.x).toBe((a?.x ?? 0) + 5);
    expect(s.setOptions([a?.id ?? ""], { color: "url(#x)" }, "Edit")).toMatch(/colour/u);
    expect(s.setOptions([a?.id ?? ""], { color: "#c00" }, "Edit", "k")).toBeUndefined();
    expect(s.setOptions(["missing"], { color: "#c00" }, "Edit")).toBeUndefined();
    expect(s.doc.items[0]?.options).toEqual({ color: "#c00" });
    expect(s.canUndo).toBe(true);
    expect(s.undo()).toBe("Edit");
    expect(s.doc.items[0]?.options).toEqual({});
    expect(s.canRedo).toBe(true);
    expect(s.redo()).toBe("Edit");
    expect(s.doc.items[0]?.options).toEqual({ color: "#c00" });
    s.resetOption([a?.id ?? ""], "color", "Reset");
    expect(s.doc.items[0]?.options).toEqual({});
    s.resetOption([a?.id ?? ""], "color", "Reset");
    s.setOptions([a?.id ?? ""], { size: 48, dotScale: 2 }, "Edit");
    s.resetItems([a?.id ?? ""], "Reset");
    expect(s.doc.items[0]?.options).toEqual({});
    s.resetItems([a?.id ?? ""], "Reset");
  });

  it("handles params, layer colours, names, duplicate and delete", () => {
    const { s } = studio();
    const shape = listShapes().find((x) =>
      Object.values(x.parameters).some((p) => p.type === "integer"),
    );
    const layered = listShapes().find((x) => x.layers.length > 1);
    if (!shape || !layered) throw new Error("catalog needs a parametric and a layered shape");
    const [name, decl] =
      Object.entries(shape.parameters).find(([, p]) => p.type === "integer") ?? [];
    const it1 = s.add(shape.id, "Add");
    if (!it1 || !name || decl?.type !== "integer") throw new Error("setup");
    expect(s.setParam([it1.id], name, decl.max + 100, "Edit")).toBeTypeOf("string");
    expect(s.setParam([it1.id], name, decl.min, "Edit")).toBeUndefined();
    expect(s.doc.items[0]?.options.params).toEqual({ [name]: decl.min });
    s.resetParam([it1.id], name, "Reset");
    expect(s.doc.items[0]?.options.params).toBeUndefined();
    s.resetParam([it1.id], name, "Reset");
    expect(s.setParam(["missing"], name, 1, "Edit")).toBeUndefined();

    const it2 = s.add(layered.id, "Add");
    const layer = layered.layers[0] ?? "";
    if (!it2) throw new Error("setup");
    expect(s.setLayerColor([it2.id], layer, "#123456", "Edit")).toBeUndefined();
    expect(s.doc.items[1]?.options.layerColors).toEqual({ [layer]: "#123456" });
    expect(s.setLayerColor([it2.id], layer, undefined, "Edit")).toBeUndefined();
    expect(s.doc.items[1]?.options.layerColors).toBeUndefined();
    expect(s.setLayerColor(["missing"], layer, "red", "Edit")).toBeUndefined();

    s.setName(it2.id, "Mine", "Rename");
    expect(s.doc.items[1]?.name).toBe("Mine");
    s.setName(it2.id, "", "Rename");
    expect(s.doc.items[1]?.name).toBeUndefined();

    s.duplicate([it1.id, it2.id], "Dup");
    expect(s.doc.items).toHaveLength(4);
    expect(s.selection).toHaveLength(2);
    s.duplicate([], "Dup");
    s.selectAll();
    expect(s.selection).toHaveLength(4);
    s.remove(s.selection, "Delete");
    expect(s.doc.items).toHaveLength(0);
    expect(s.selection).toEqual([]);
    s.remove(["nothing"], "Delete");
    expect(s.undo()).toBe("Delete");
    expect(s.doc.items).toHaveLength(4);
  });

  it("keeps locked items in place and selects", () => {
    const { s } = studio();
    s.doc = parseDoc({ v: 1, items: [item({ locked: true }), item({ id: "i2", hidden: true })] });
    s.moveBy(["i1"], 5, 0, "Move");
    expect(s.doc.items[0]?.x).toBe(0);
    s.remove(["i1"], "Delete");
    expect(s.doc.items).toHaveLength(2);
    expect(s.setOptions(["i1"], { color: "red" }, "Edit")).toBeUndefined();
    s.resetOption(["i1"], "color", "Reset");
    s.select("i1");
    s.select("i2", true);
    expect(s.selection).toEqual(["i1", "i2"]);
    s.select("i1", true);
    expect(s.selection).toEqual(["i2"]);
    expect(s.current?.id).toBe("i2");
    s.selectAll();
    expect(s.selection).toEqual(["i1"]);
    s.deselect();
    expect(s.current).toBeUndefined();
    s.duplicate(["i1"], "Dup");
    expect(s.doc.items[2]?.locked).toBeUndefined();
  });

  it("previews and commits drags, and changes the view", () => {
    const { s } = studio();
    s.add("kurdish-sun", "Add", { x: 12, y: 12 });
    const before = s.doc;
    s.commitPreview(before, "Move");
    s.preview({ ...before, items: before.items.map((i) => ({ ...i, x: i.x + 8 })) });
    s.commitPreview(before, "Move");
    expect(s.undo()).toBe("Move");
    expect(s.doc).toBe(before);
    s.commit(s.doc, "same");
    expect(s.undo()).toBe("Add");
    expect(s.undo()).toBeUndefined();
    expect(s.redo()).toBe("Add");
    s.redo();
    expect(s.redo()).toBeUndefined();

    s.view = { x: 0, y: 0, zoom: 1 };
    s.zoomIn(100, 100);
    expect(s.view.zoom).toBe(ZOOM.step);
    s.zoomOut(100, 100);
    expect(s.view.zoom).toBeCloseTo(1);
    s.zoomTo(2, 100, 100);
    expect(s.view.zoom).toBe(2);
    s.panBy(10, 0);
    expect(s.view.x).toBeCloseTo(20);
    s.fit(400, 400);
    s.deselect();
    s.fit(400, 400);
    s.doc = EMPTY_DOC;
    s.fit(400, 400);
    expect(s.view.zoom).toBeGreaterThan(1);
  });

  it("toggles overlays and restores saved state, ignoring bad data", () => {
    const storage = new MemoryStorage();
    const s = new Studio(storage);
    s.toggle("keylines");
    s.add("kurdish-sun", "Add");
    const t = new Studio(storage);
    t.load();
    expect(t.overlays.keylines).toBe(true);
    expect(t.doc.items).toHaveLength(1);
    storage.setItem("deq-studio-doc", '{"v":1,"items":[{"id":"BAD"}]}');
    storage.setItem("deq-studio-prefs", '{"grid":"yes","snap":false}');
    const u = new Studio(storage);
    u.load();
    expect(u.doc).toBe(EMPTY_DOC);
    expect(u.overlays.grid).toBe(true);
    expect(u.overlays.snap).toBe(false);
    storage.setItem("deq-studio-prefs", "{oops");
    const w = new Studio(storage);
    w.load();
    expect(w.overlays.grid).toBe(true);
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
    };
    const x = new Studio(broken);
    expect(() => {
      x.add("kurdish-sun", "Add");
      x.toggle("grid");
    }).not.toThrow();
    const y = new Studio(undefined);
    y.load();
    expect(y.doc.items).toHaveLength(0);
  });

  it("announces and caps items", async () => {
    const { s } = studio();
    s.announce("hello");
    expect(s.announcement).toBe("");
    await Promise.resolve();
    expect(s.announcement).toBe("hello");
    s.doc = {
      v: 1,
      items: Array.from({ length: 500 }, (_, i) => item({ id: `i${String(i)}`, x: i })),
    };
    expect(s.add("kurdish-sun", "Add")).toBeUndefined();
    s.duplicate(["i1"], "Dup");
    expect(s.doc.items).toHaveLength(500);
  });

  it("batch edits, arranges, groups, locks and hides a selection", () => {
    const { s } = studio();
    s.doc = parseDoc({
      v: 1,
      items: [
        item({ id: "a" }),
        item({ id: "b", x: 50, y: 10 }),
        item({ id: "c", x: 200, y: 100 }),
      ],
    });
    s.selectAll();
    expect(s.units).toBe(3);
    expect(s.setOptions(s.selection, { color: "#c00" }, "Edit")).toBeUndefined();
    expect(s.doc.items.every((i) => i.options.color === "#c00")).toBe(true);
    s.align("left", "Align");
    expect(s.doc.items.map((i) => i.x)).toEqual([0, 0, 0]);
    s.align("left", "Align");
    expect(s.undo()).toBe("Align");
    s.distribute("y", "Distribute");
    expect(s.doc.items[1]?.y).toBe(50);
    s.arrange("back", "Order");
    s.select("c");
    s.arrange("back", "Order");
    expect(s.doc.items[0]?.id).toBe("c");
    s.arrange("back", "Order", ["c"]);
    expect(s.undo()).toBe("Order");

    s.selectIds(["a", "b"]);
    s.group("Group");
    expect(s.doc.items.filter((i) => i.group)).toHaveLength(2);
    s.select("a");
    expect(s.selection.toSorted()).toEqual(["a", "b"]);
    expect(s.units).toBe(1);
    s.select("c", true);
    expect(s.selection).toHaveLength(3);
    s.select("b", true);
    expect(s.selection).toEqual(["c"]);
    s.selectIds(["a"], true);
    expect(s.selection.toSorted()).toEqual(["a", "b", "c"]);
    s.duplicate(["a", "b"], "Dup");
    const copies = s.doc.items.slice(-2);
    expect(copies[0]?.group).toBe("g2");
    expect(copies[1]?.group).toBe("g2");
    s.select("a");
    s.ungroup("Ungroup");
    expect(s.doc.items.find((i) => i.id === "a")?.group).toBeUndefined();

    s.setFlag(["a", "b"], "locked", "Lock");
    expect(s.doc.items.filter((i) => i.locked)).toHaveLength(2);
    s.setFlag(["a", "b"], "locked", "Lock");
    expect(s.doc.items.filter((i) => i.locked)).toHaveLength(0);
    s.setFlag(["a"], "hidden", "Hide", true);
    expect(s.doc.items.find((i) => i.id === "a")?.hidden).toBe(true);
    s.setFlag(["missing"], "hidden", "Hide");
    expect(s.undo()).toBe("Hide");
  });
});
