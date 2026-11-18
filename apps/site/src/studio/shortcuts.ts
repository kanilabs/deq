/**
 * Keyboard shortcuts: the default map, matching key events, and user overrides kept in
 * local storage (PRD §8.5: documented and remappable).
 *
 * A combo is `Mod+Shift+Alt+Key`, where `Mod` is ⌘ on Apple platforms and Ctrl
 * elsewhere, and `Key` is a `KeyboardEvent.key` value (letters upper-case).
 */
export const ACTIONS = [
  "undo",
  "redo",
  "delete",
  "duplicate",
  "selectAll",
  "deselect",
  "nudgeLeft",
  "nudgeRight",
  "nudgeUp",
  "nudgeDown",
  "nudgeLeftBig",
  "nudgeRightBig",
  "nudgeUpBig",
  "nudgeDownBig",
  "zoomIn",
  "zoomOut",
  "zoomReset",
  "zoomFit",
  "toggleGrid",
  "toggleKeylines",
  "togglePixels",
  "toggleRulers",
  "toggleSnap",
  "search",
  "help",
] as const;
export type Action = (typeof ACTIONS)[number];
export type Bindings = Readonly<Record<Action, readonly string[]>>;

export const DEFAULT_BINDINGS: Bindings = {
  undo: ["Mod+Z"],
  redo: ["Mod+Shift+Z", "Mod+Y"],
  delete: ["Delete", "Backspace"],
  duplicate: ["Mod+D"],
  selectAll: ["Mod+A"],
  deselect: ["Escape"],
  nudgeLeft: ["ArrowLeft"],
  nudgeRight: ["ArrowRight"],
  nudgeUp: ["ArrowUp"],
  nudgeDown: ["ArrowDown"],
  nudgeLeftBig: ["Shift+ArrowLeft"],
  nudgeRightBig: ["Shift+ArrowRight"],
  nudgeUpBig: ["Shift+ArrowUp"],
  nudgeDownBig: ["Shift+ArrowDown"],
  zoomIn: ["+", "="],
  zoomOut: ["-"],
  zoomReset: ["0"],
  zoomFit: ["1"],
  toggleGrid: ["G"],
  toggleKeylines: ["K"],
  togglePixels: ["P"],
  toggleRulers: ["R"],
  toggleSnap: ["S"],
  search: ["/"],
  help: ["?"],
};

/** Actions that still fire while typing in a text field. */
const IN_FIELDS: ReadonlySet<Action> = new Set(["undo", "redo"]);

export interface KeyLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt", "AltGraph", "OS"]);

/**
 * The combo for a key event, or undefined for a bare modifier. Shift is only written for
 * letters and named keys: for symbols the key value already includes it (`?`, `+`).
 */
export function comboOf(e: KeyLike, apple: boolean): string | undefined {
  if (MODIFIER_KEYS.has(e.key)) return undefined;
  const named = e.key.length > 1;
  const letter = /^[a-z]$/iu.test(e.key);
  const key = letter ? e.key.toUpperCase() : e.key === " " ? "Space" : e.key;
  const parts: string[] = [];
  if (apple ? e.metaKey : e.ctrlKey) parts.push("Mod");
  if (apple && e.ctrlKey) parts.push("Ctrl");
  if (e.shiftKey && (named || letter)) parts.push("Shift");
  if (e.altKey) parts.push("Alt");
  parts.push(key);
  return parts.join("+");
}

/** Merge stored overrides over the defaults, dropping anything malformed. */
export function mergeBindings(overrides: unknown): Bindings {
  const out: Record<string, readonly string[]> = { ...DEFAULT_BINDINGS };
  if (overrides && typeof overrides === "object") {
    for (const [action, combos] of Object.entries(overrides)) {
      if (!(ACTIONS as readonly string[]).includes(action) || !Array.isArray(combos)) continue;
      const clean = combos.filter(
        (c): c is string => typeof c === "string" && c.length > 0 && c.length <= 32,
      );
      out[action] = clean.slice(0, 4);
    }
  }
  return out as Bindings;
}

/** Only the actions whose combos differ from the defaults. */
export function diffBindings(bindings: Bindings): Partial<Record<Action, readonly string[]>> {
  const out: Partial<Record<Action, readonly string[]>> = {};
  for (const action of ACTIONS) {
    if (bindings[action].join("|") !== DEFAULT_BINDINGS[action].join("|"))
      out[action] = bindings[action];
  }
  return out;
}

/** Rebind `action` to `combo`, removing that combo from any other action. */
export function rebind(bindings: Bindings, action: Action, combo: string): Bindings {
  const out: Record<string, readonly string[]> = {};
  for (const a of ACTIONS) out[a] = bindings[a].filter((c) => c !== combo);
  out[action] = [combo];
  return out as Bindings;
}

/** The action bound to a key event, honouring text-field focus. */
export function actionFor(
  bindings: Bindings,
  e: KeyLike,
  apple: boolean,
  inField: boolean,
): Action | undefined {
  const combo = comboOf(e, apple);
  if (!combo) return undefined;
  const action = ACTIONS.find((a) => bindings[a].includes(combo));
  if (!action || (inField && !IN_FIELDS.has(action))) return undefined;
  return action;
}

/** A combo for display: `Mod` becomes ⌘ or Ctrl. */
export function displayCombo(combo: string, apple: boolean): string {
  return combo
    .split("+")
    .map((p) => (p === "Mod" ? (apple ? "⌘" : "Ctrl") : p))
    .join(apple ? "" : "+");
}

const STORAGE_KEY = "deq-studio-shortcuts";

export function loadBindings(storage: Pick<Storage, "getItem"> | undefined): Bindings {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return mergeBindings(raw ? (JSON.parse(raw) as unknown) : undefined);
  } catch {
    return DEFAULT_BINDINGS;
  }
}

export function saveBindings(
  storage: Pick<Storage, "setItem" | "removeItem"> | undefined,
  bindings: Bindings,
): void {
  try {
    const diff = diffBindings(bindings);
    if (Object.keys(diff).length === 0) storage?.removeItem(STORAGE_KEY);
    else storage?.setItem(STORAGE_KEY, JSON.stringify(diff));
  } catch {
    // Storage can be unavailable (private mode, blocked site data): keep the session map.
  }
}
