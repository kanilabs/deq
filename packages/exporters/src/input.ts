/** Export inputs: catalog shapes or compositions, plus the files exporters produce. */
import { DeqError, composeShape, getShape, prepare } from "@0xdolan/deq-core";
import type {
  CompositionPart,
  ParamValue,
  Prepared,
  RenderOptions,
  ShapeData,
} from "@0xdolan/deq-core";

/** One catalog shape, with optional parameters and render options. */
export interface ShapeItem {
  /** Catalog shape id, for example `roj-half-sun`. */
  readonly shape: string;
  /** Shape parameter values; merged over `options.params`. */
  readonly params?: Readonly<Record<string, ParamValue>>;
  /** Render options for this item; merged over the exporter's `render` options. */
  readonly options?: RenderOptions;
  /** Base file name (kebab case). Default: the shape id. */
  readonly name?: string;
}

/** Several catalog shapes on one canvas, one layer per part (see `compose` in core). */
export interface CompositionItem {
  readonly parts: readonly CompositionPart[];
  readonly options?: RenderOptions;
  /** Base file name (kebab case). Default: `composition`. */
  readonly name?: string;
}

/** What every exporter accepts: a shape id, a {@link ShapeItem} or a {@link CompositionItem}. */
export type ExportItem = string | ShapeItem | CompositionItem;

/** One output file. Text formats return a string, binary formats a `Uint8Array`. */
export interface ExportFile {
  /** File name with extension, for example `kurdish-sun.pdf`. Never contains a path. */
  readonly name: string;
  /** IANA media type. */
  readonly mediaType: string;
  readonly data: string | Uint8Array;
}

/** An item resolved into a shape description, its render options and its geometry. */
export interface Resolved {
  /** Safe base file name. */
  readonly name: string;
  readonly shape: ShapeData;
  /** The merged render options (unresolved, so a format can override some of them). */
  readonly options: RenderOptions;
  readonly prepared: Prepared;
}

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Most items one export call accepts. */
export const MAX_ITEMS = 512;

function checkName(name: string): string {
  if (name.length > 64 || !NAME.test(name)) {
    const issue = `name: must be kebab case, at most 64 characters (got ${JSON.stringify(name.slice(0, 80))})`;
    throw new DeqError("INVALID_OPTIONS", `invalid export item: ${issue}`, [issue]);
  }
  return name;
}

/**
 * Resolve one item. `defaults` are the exporter's render options; the item's own options
 * and parameters win.
 *
 * @throws {DeqError} for unknown shapes, bad names, options or parameters.
 */
export function resolveItem(item: ExportItem, defaults: RenderOptions = {}): Resolved {
  if (typeof item === "string") return resolveItem({ shape: item }, defaults);
  if ("parts" in item) {
    const shape = composeShape(item.parts);
    const options: RenderOptions = { ...defaults, ...item.options, params: {} };
    const name = checkName(item.name ?? "composition");
    return { name, shape, options, prepared: prepare(shape, options) };
  }
  const shape = getShape(item.shape);
  const params = { ...defaults.params, ...item.options?.params, ...item.params };
  const options: RenderOptions = { ...defaults, ...item.options, params };
  const name = checkName(item.name ?? shape.id);
  return { name, shape, options, prepared: prepare(shape, options) };
}

/**
 * Resolve a list of items, rejecting empty lists, more than {@link MAX_ITEMS} items and
 * duplicate file names.
 */
export function resolveItems(
  items: readonly ExportItem[],
  defaults: RenderOptions = {},
): Resolved[] {
  if (items.length === 0 || items.length > MAX_ITEMS) {
    const issue = `items: give 1 to ${String(MAX_ITEMS)} items (got ${String(items.length)})`;
    throw new DeqError("INVALID_OPTIONS", `invalid export: ${issue}`, [issue]);
  }
  const out = items.map((i) => resolveItem(i, defaults));
  const seen = new Set<string>();
  for (const r of out) {
    if (seen.has(r.name)) {
      const issue = `items: duplicate name ${r.name}; give each item a unique \`name\``;
      throw new DeqError("INVALID_OPTIONS", `invalid export: ${issue}`, [issue]);
    }
    seen.add(r.name);
  }
  return out;
}
