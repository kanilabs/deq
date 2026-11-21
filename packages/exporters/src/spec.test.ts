import { render, renderShapeData } from "@0xdolan/deq-core";
import type { ShapeData } from "@0xdolan/deq-core";
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveItem } from "./input.js";
import { toSpecJson, toSpecShape } from "./spec.js";

const schema = JSON.parse(
  readFileSync(new URL("../../../spec/schema/shape.schema.json", import.meta.url), "utf8"),
) as { $id: string; properties: Record<string, unknown> };

const ajv = new Ajv2020({ strict: false, allErrors: true });
ajv.addSchema(schema);
const check = (def: string) => ajv.compile({ $ref: `${schema.$id}#/$defs/${def}` });
const primitive = check("primitive");
const parameter = check("parameter");
const id = check("id");
const category = ajv.compile(schema.properties["category"] as object);

/** The parts of a spec shape the schema can check without meaning, sources or metrics. */
function expectValid(shape: ShapeData): void {
  expect(id(shape.id), shape.id).toBe(true);
  expect(category(shape.category), shape.category).toBe(true);
  for (const p of shape.primitives) {
    expect(primitive(p), JSON.stringify(primitive.errors)).toBe(true);
  }
  for (const p of Object.values(shape.parameters)) {
    expect(parameter(p), JSON.stringify(parameter.errors)).toBe(true);
  }
}

describe("spec JSON", () => {
  it("returns a catalog shape with default parameters as is", () => {
    const r = resolveItem("roj-half-sun");
    expect(toSpecShape(r)).toBe(r.shape);
    expect(toSpecJson(r).endsWith("}\n")).toBe(true);
  });

  it("bakes custom parameters into a renamed copy that renders the same", () => {
    const r = resolveItem({ shape: "roj-half-sun", name: "my-sun", params: { rays: 5 } });
    const shape = JSON.parse(toSpecJson(r)) as ShapeData;
    expect(shape).toMatchObject({ id: "my-sun", version: 1, aliases: [] });
    expect(shape.parameters["rays"]?.default).toBe(5);
    expectValid(shape);
    expect(renderShapeData(shape)).toBe(render("roj-half-sun", { params: { rays: 5 } }));
    // Same values as the defaults, but a new name: still a copy.
    expect(toSpecShape(resolveItem({ shape: "chevron", name: "arrow" })).id).toBe("arrow");
  });

  it("keeps compositions re-importable", () => {
    const r = resolveItem({
      parts: [
        { shape: "chevron" },
        { shape: "roj-half-sun", layer: "sun", transform: { scale: 0.5 } },
      ],
    });
    const shape = JSON.parse(toSpecJson(r)) as ShapeData;
    expect(shape).toMatchObject({ id: "composition", category: "compositions" });
    expect(shape.names.en).toBe("Composition");
    expectValid(shape);
    expect(renderShapeData(shape)).toBe(renderShapeData(r.shape));
  });

  it("validates every catalog shape's primitives", () => {
    for (const s of ["kurdish-sun", "kurdish-flag", "dimlich", "lozenge"]) {
      expectValid(toSpecShape(resolveItem(s)));
    }
  });
});
