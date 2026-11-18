/**
 * Shape lookup for the Studio: catalog shapes from core plus the custom shapes in play
 * (the library and the ones embedded in the open design, which win on a clash).
 */
import { getShape, hasShape, type ShapeData } from "@0xdolan/deq-core";

import { toShapeData, type CustomDef } from "./custom.ts";

let custom = new Map<string, ShapeData>();

/** Replace the custom shapes; later lists win, so pass the library before the design. */
export function setCustomShapes(...lists: readonly (readonly CustomDef[])[]): void {
  const next = new Map<string, ShapeData>();
  for (const list of lists) for (const def of list) next.set(def.id, toShapeData(def));
  custom = next;
}

/** A catalog or custom shape. @throws like core's getShape for unknown ids. */
export function shapeOf(id: string): ShapeData {
  return custom.get(id) ?? getShape(id);
}

export function knownShape(id: string): boolean {
  return custom.has(id) || hasShape(id);
}
