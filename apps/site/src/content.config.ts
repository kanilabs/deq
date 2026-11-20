import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema, i18nSchema } from "@astrojs/starlight/schema";

import { starlightStrings } from "./i18n/starlight.ts";

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
  // Starlight's UI strings for ckb and kmr come from the typed catalog, not JSON files.
  i18n: defineCollection({
    loader: () => Object.entries(starlightStrings).map(([id, strings]) => ({ id, ...strings })),
    schema: i18nSchema(),
  }),
  // The cited story (ADR 0018): `content/story/<locale>/NN-<slug>.mdx`, ids like `ckb/03-making`.
  story: defineCollection({
    loader: glob({ pattern: "*/[0-9][0-9]-*.mdx", base: "../../content/story" }),
    schema: z.object({ title: z.string().min(1), description: z.string().min(1) }),
  }),
};
