import type { IconOptions } from "@0xdolan/deq-icons";

/** The icon options that are set, so unset props fall back to the defaults. */
export function iconOptions(props: Readonly<Record<keyof IconOptions, unknown>>): IconOptions {
  return Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined));
}
