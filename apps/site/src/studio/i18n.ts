/**
 * The Studio's slice of the UI catalog. The page passes only these keys to the island,
 * so the client bundle does not carry every catalog.
 */
import type { MessageKey, Messages } from "../i18n/messages/en.ts";

export type StudioKey = Extract<MessageKey, `studio.${string}` | `category.${string}`>;
export type StudioMessages = Readonly<Record<StudioKey, string>>;

/** The Studio keys of a full catalog. */
export function studioMessages(catalog: Messages): StudioMessages {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(catalog)) {
    if (key.startsWith("studio.") || key.startsWith("category.")) out[key] = value;
  }
  return out as StudioMessages;
}

/** A translator over the Studio messages; `{name}` placeholders are filled from `vars`. */
export function translator(messages: StudioMessages): Translate {
  return (key: StudioKey, vars: Readonly<Record<string, string | number>> = {}): string =>
    messages[key].replace(/\{(\w+)\}/gu, (m, name: string) =>
      name in vars ? String(vars[name]) : m,
    );
}
export type Translate = (
  key: StudioKey,
  vars?: Readonly<Record<string, string | number>>,
) => string;
