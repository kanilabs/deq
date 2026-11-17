/**
 * `deq validate`: a structural check of a shape spec file, then a render of the defaults and
 * of every parameter value. The Python and Rust ports implement the same table and messages.
 */
import { DeqError, prepare } from "@0xdolan/deq-core";
import type { ParamValue, ShapeData } from "@0xdolan/deq-core";

type Kind =
  | "num"
  | "vec"
  | "vecs"
  | "str"
  | "count"
  | "paint"
  | "align"
  | "prim"
  | "params"
  | "transform"
  | "when";

/** Fields of each primitive type; `?` marks an optional field. */
export const PRIMITIVES: Readonly<Record<string, Readonly<Record<string, Kind>>>> = {
  line: { x1: "num", y1: "num", x2: "num", y2: "num" },
  polyline: { points: "vecs" },
  polygon: { points: "vecs", "paint?": "paint" },
  path: { d: "str", "paint?": "paint" },
  circle: { cx: "num", cy: "num", r: "num", "paint?": "paint" },
  dot: { cx: "num", cy: "num", "r?": "num" },
  arc: { cx: "num", cy: "num", r: "num", start: "num", end: "num" },
  ellipse: { cx: "num", cy: "num", rx: "num", ry: "num", "paint?": "paint" },
  rect: { x: "num", y: "num", width: "num", height: "num", "paint?": "paint" },
  star: {
    cx: "num",
    cy: "num",
    points: "count",
    outerRadius: "num",
    innerRadius: "num",
    rotation: "num",
    "paint?": "paint",
  },
  radial: { count: "count", center: "vec", start: "num", sweep: "num", element: "prim" },
  repeat: {
    count: "count",
    "step?": "vec",
    "spread?": "vec",
    "align?": "align",
    element: "prim",
  },
  concentric: { count: "count", center: "vec", scaleStep: "num", element: "prim" },
  use: { shape: "str", "params?": "params", "transform?": "transform" },
};
const COMMON: Readonly<Record<string, Kind>> = { "id?": "str", "layer?": "str", "when?": "when" };
/** Top-level fields that do not affect rendering and are not checked here. */
const DOC_FIELDS = new Set([
  "$schema",
  "meaning",
  "sources",
  "construction",
  "references",
  "metrics",
  "symmetryCenter",
]);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Largest spec file `validate` reads. */
export const MAX_SPEC_BYTES = 256 * 1024;
/** Integer parameters with a wider range are checked at min, default and max only. */
const MAX_RANGE = 64;

class Invalid extends Error {}
function fail(path: string, what: string): never {
  throw new Invalid(`${path}: ${what}`);
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
const isObject = (x: unknown): x is Record<string, Json> =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isVec = (x: unknown): boolean => Array.isArray(x) && x.length === 2 && x.every(isNum);
const isStrList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((s) => typeof s === "string");

function checkValue(path: string, kind: Kind, x: unknown, depth: number): void {
  switch (kind) {
    case "num":
      if (!isNum(x)) fail(path, "must be a number");
      return;
    case "vec":
      if (!isVec(x)) fail(path, "must be an [x, y] pair");
      return;
    case "vecs":
      if (!Array.isArray(x) || !x.every(isVec)) fail(path, "must be a list of [x, y] pairs");
      return;
    case "str":
      if (typeof x !== "string") fail(path, "must be a string");
      return;
    case "count":
      if (isObject(x)) {
        if (Object.keys(x).length !== 1 || typeof x["param"] !== "string") {
          fail(path, 'must be a number or {"param": name}');
        }
      } else if (!isNum(x)) fail(path, 'must be a number or {"param": name}');
      return;
    case "paint":
      if (x !== "stroke" && x !== "fill") fail(path, 'must be "stroke" or "fill"');
      return;
    case "align":
      if (x !== "start" && x !== "center") fail(path, 'must be "start" or "center"');
      return;
    case "prim":
      checkPrimitive(path, x, depth + 1);
      return;
    case "params":
      if (!isObject(x)) fail(path, "must be an object");
      else {
        for (const [k, v] of Object.entries(x)) {
          if (!(isNum(v) || typeof v === "boolean" || typeof v === "string")) {
            fail(`${path}.${k}`, "must be a number, true, false or a string");
          }
        }
      }
      return;
    case "transform":
      if (!isObject(x)) fail(path, "must be an object");
      else {
        const fields: Record<string, Kind> = {
          "translate?": "vec",
          "scale?": "num",
          "rotate?": "num",
          "origin?": "vec",
        };
        checkFields(path, x, fields, depth);
      }
      return;
    case "when":
      if (!isObject(x)) fail(path, "must be an object");
      else {
        for (const [k, v] of Object.entries(x)) {
          const ok =
            isNum(v) ||
            typeof v === "boolean" ||
            typeof v === "string" ||
            (Array.isArray(v) && v.every((e) => isNum(e) || typeof e === "string"));
          if (!ok) fail(`${path}.${k}`, "must be a value or a list of values");
        }
      }
      return;
  }
}

function checkFields(
  path: string,
  x: Record<string, Json>,
  fields: Readonly<Record<string, Kind>>,
  depth: number,
): void {
  const known = new Map(Object.entries(fields).map(([k, v]) => [k.replace("?", ""), v]));
  for (const key of Object.keys(x)) {
    if (!known.has(key)) fail(path, `unknown field "${key}"`);
  }
  for (const [raw, kind] of Object.entries(fields)) {
    const key = raw.replace("?", "");
    const value = x[key];
    if (value === undefined) {
      if (!raw.endsWith("?")) fail(path, `missing field "${key}"`);
      continue;
    }
    checkValue(`${path}.${key}`, kind, value, depth);
  }
}

function checkPrimitive(path: string, x: unknown, depth: number): void {
  if (depth > 8) fail(path, "nested too deeply");
  if (!isObject(x)) fail(path, "must be an object");
  const prim = x;
  const type = prim["type"];
  const fields = typeof type === "string" ? PRIMITIVES[type] : undefined;
  if (!fields) {
    fail(`${path}.type`, `must be one of ${Object.keys(PRIMITIVES).join(", ")}`);
    return;
  }
  checkFields(path, prim, { "type?": "str", ...COMMON, ...fields }, depth);
}

function checkKurdish(path: string, x: unknown): void {
  if (!isObject(x)) fail(path, "must be an object");
  const k = x;
  if (!(k["text"] === null || typeof k["text"] === "string"))
    fail(`${path}.text`, "must be a string or null");
  if (typeof k["status"] !== "string") fail(`${path}.status`, "must be a string");
}

function checkParameter(path: string, x: unknown): void {
  if (!isObject(x)) fail(path, "must be an object");
  const p = x;
  const int = (v: unknown): boolean => isNum(v) && Number.isInteger(v);
  if (typeof p["description"] !== "string") fail(`${path}.description`, "must be a string");
  switch (p["type"]) {
    case "integer":
      if (!int(p["min"]) || !int(p["max"]) || !int(p["default"])) {
        fail(path, "min, max and default must be integers");
      }
      if (!(
        (p["min"] as number) <= (p["default"] as number) &&
        (p["default"] as number) <= (p["max"] as number)
      )) {
        fail(path, "default must be between min and max");
      }
      return;
    case "boolean":
      if (typeof p["default"] !== "boolean") fail(`${path}.default`, "must be true or false");
      return;
    case "enum":
      if (!isStrList(p["values"]) || p["values"].length === 0) {
        fail(`${path}.values`, "must be a non-empty list of strings");
      }
      if (!p["values"].includes(p["default"] as string)) {
        fail(`${path}.default`, "must be one of the values");
      }
      return;
    default:
      fail(`${path}.type`, "must be integer, boolean or enum");
  }
}

/** Check the structure of a parsed spec file and return it as shape data. */
export function checkSpec(x: unknown): ShapeData {
  if (!isObject(x)) fail("spec", "must be a JSON object");
  const s = x;
  const top: Record<string, (path: string, v: unknown) => void> = {
    id: (p, v) => {
      if (typeof v !== "string" || v.length > 64 || !KEBAB.test(v)) {
        fail(p, "must be kebab case, at most 64 characters");
      }
    },
    version: (p, v) => {
      if (!isNum(v) || !Number.isInteger(v) || v < 1) fail(p, "must be a positive integer");
    },
    category: (p, v) => {
      if (typeof v !== "string") fail(p, "must be a string");
    },
    names: (p, v) => {
      if (!isObject(v)) fail(p, "must be an object");
      const n = v;
      if (typeof n["en"] !== "string") fail(`${p}.en`, "must be a string");
      checkKurdish(`${p}.ckb`, n["ckb"]);
      checkKurdish(`${p}.kmr`, n["kmr"]);
    },
    aliases: (p, v) => {
      if (!isStrList(v)) fail(p, "must be a list of strings");
    },
    tags: (p, v) => {
      if (!isStrList(v)) fail(p, "must be a list of strings");
    },
    layers: (p, v) => {
      if (!isStrList(v) || v.length === 0 || !v.every((l) => KEBAB.test(l))) {
        fail(p, "must be a non-empty list of kebab-case ids");
      }
    },
    symmetry: (p, v) => {
      if (typeof v !== "string") fail(p, "must be a string");
    },
    parameters: (p, v) => {
      if (!isObject(v)) fail(p, "must be an object");
      for (const [k, d] of Object.entries(v)) checkParameter(`${p}.${k}`, d);
    },
    primitives: (p, v) => {
      if (!Array.isArray(v) || v.length === 0) fail(p, "must be a non-empty list");
      (v as Json[]).forEach((prim, i) => {
        checkPrimitive(`${p}[${String(i)}]`, prim, 0);
      });
    },
  };
  const optional = new Set(["aliases", "tags", "symmetry"]);
  for (const key of Object.keys(s)) {
    if (!(key in top) && !DOC_FIELDS.has(key)) fail("spec", `unknown field "${key}"`);
  }
  for (const [key, check] of Object.entries(top)) {
    if (s[key] === undefined) {
      if (!optional.has(key)) fail("spec", `missing field "${key}"`);
      continue;
    }
    check(key, s[key]);
  }
  return {
    id: s["id"],
    version: s["version"],
    category: s["category"],
    names: s["names"],
    aliases: s["aliases"] ?? [],
    tags: s["tags"] ?? [],
    layers: s["layers"],
    symmetry: s["symmetry"] ?? "none",
    parameters: s["parameters"],
    primitives: s["primitives"],
  } as unknown as ShapeData;
}

/** The parameter overrides `validate` renders: the defaults, then each other value. */
export function variants(shape: ShapeData): Record<string, ParamValue>[] {
  const out: Record<string, ParamValue>[] = [{}];
  for (const [name, p] of Object.entries(shape.parameters)) {
    let values: ParamValue[];
    if (p.type === "integer") {
      values = [];
      if (p.max - p.min > MAX_RANGE) values = [p.min, p.max];
      else for (let i = p.min; i <= p.max; i++) values.push(i);
    } else if (p.type === "boolean") values = [true, false];
    else values = [...p.values];
    for (const v of values) if (v !== p.default) out.push({ [name]: v });
  }
  return out;
}

/**
 * Validate parsed spec JSON. Returns a summary line; throws `DeqError` (`INVALID_SHAPE` for
 * structural problems, or the renderer's code) naming the first problem.
 */
export function validateSpec(json: unknown): { id: string; variants: number } {
  let shape: ShapeData;
  try {
    shape = checkSpec(json);
  } catch (error) {
    if (error instanceof Invalid)
      throw new DeqError("INVALID_SHAPE", error.message, [error.message]);
    throw error;
  }
  const list = variants(shape);
  for (const params of list) prepare(shape, { params });
  return { id: shape.id, variants: list.length };
}
