import { defineCollection } from "astro:content";
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
};
