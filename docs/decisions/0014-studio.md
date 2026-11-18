# 14. Studio

- Status: accepted
- Date: 2026-11-17
- Amends: the Studio stack in PRD §8.5 (React + Zustand + Immer)

## Context

Phase 8 adds Studio to the website: a canvas editor that places shapes, edits every render option, and exports through every exporter. The site is Astro + Starlight (ADR 0012) with a strict, hash-based `<meta>` CSP. The PRD named React, Zustand and Immer for Studio's state. The work is large, so it ships as four pull requests.

## Decision

- **Svelte 5, not React.** The owner chose Svelte 5 (runes) over React + Zustand + Immer. Svelte compiles to small, dependency-free code. `$state` replaces Zustand, and immutable snapshots replace Immer. Studio is one island (`client:only="svelte"`) on `/{locale}/studio/`, so no other page loads its JavaScript, and the 50 KB budget for non-Studio pages still applies. `@astrojs/svelte` runs before the `fonts`, `csp` and `pwa` integrations. `svelte-check` joins `astro check` in `typecheck`.
- **Plain modules, thin components.** The model, history, search, snapping, view maths and shortcuts are plain TypeScript in `apps/site/src/studio/` and unit-tested in Node. The `Studio` class in `store.svelte.ts` holds the reactive state. Components in `src/studio/components/` only render it and dispatch actions.
- **Document model.** A design is `{ v: 1, items }`. Each item has an id, a shape id, x/y in canvas px, the render options that differ from the defaults, and optional name, locked and hidden flags. `title` and `ariaLabel` are not stored: the name becomes the title. `parseDoc` validates any document from outside (local storage now; files and share links in 8d) with valibot. It then runs core's `prepare` on every item, so unknown shapes, bad colours and out-of-range parameters are rejected with a message. Limits: 500 items, coordinates within ±10⁶, names of up to 80 characters.
- **History.** Undo and redo keep whole-document snapshots, up to 200 steps. Edits that share a key within one second (typing in a field, dragging a slider) merge into one step. A pointer drag previews without recording, then commits once. Snapshots share unchanged items, so memory stays small.
- **Rendering.** Items are drawn as nested `<svg>` from core's `render`, memoised per shape and options. Markup is parsed with `DOMParser` as `image/svg+xml` and imported. It is never assigned to `innerHTML`. Documents containing `script` or `foreignObject` are refused.
- **Persistence.** The design, overlay preferences and remapped shortcuts autosave to `localStorage`. Every read and write is wrapped in try/catch, and Studio works without storage.
- **Accessibility.** Every action has a toolbar button or a keyboard shortcut. Shortcuts are listed in a dialog and can be remapped there. Items are focusable buttons with their position in the label, and changes are announced in a live region. Below 60 rem, a tab bar shows one pane at a time.
- **Pull requests.** 8a: canvas, library, inspector, history, view, overlays and shortcuts. 8b: multi-select, batch editing and layers. 8c: custom shapes, the path editor and boolean operations. 8d: import, share links, export in every format, and the full end-to-end suite.
- **Later decisions recorded now.** Boolean operations (8c) keep curves through a curve-aware library (paper.js), loaded only when first used. Raster export in the browser (8d) runs resvg and jSquash as WebAssembly. That needs `'wasm-unsafe-eval'` in `script-src` on the Studio page only, and 8d will confirm it in an amendment to this ADR. Imported SVG (8d) is sanitised with DOMPurify before parsing.

## Phase 8b amendment

- **Flat groups.** An item may carry `group: "g<n>"`. Items that share it select, move, align, distribute and reorder as one unit. There is no nesting. Grouping moves the members next to each other, just below the topmost selected item. Ungrouping only removes the id. Duplicating a group gives the copies a new group id. `parseDoc` accepts `group` only as `g` followed by up to six digits.
- **Layer order is document order.** Later items are drawn on top. The layers panel lists items top first. Ordering moves runs of neighbouring group members as one block.
- **Batch editing.** Option, parameter and layer-colour edits take the selected ids. Core validates the result for every unlocked item before the edit is committed, so either all items change or none do. Parameters and layer colours only show when every selected item is the same shape. Fields where the items differ show "Mixed", and checkboxes are indeterminate.
- **Marquee and pan.** A mouse or pen drag on the background draws a marquee that selects every visible shape it touches; Shift adds to the selection. Touch drags, the middle button and Space-drag pan. The wheel pans and Ctrl+wheel zooms, as before.
- **Shortcuts.** Group (Mod+G), ungroup (Mod+Shift+G), layer order (Mod+Arrow Up/Down, with Shift to the front or back), lock (Mod+Shift+L) and hide (Mod+Shift+H) have defaults. The six align and two distribute actions have none, because Alt+letter types characters on some keyboard layouts. They can be bound in the shortcuts dialog and are always available in the inspector.

## Consequences

- Studio's state code is not React-shaped. Contributors familiar with the PRD should read this ADR first.
- The Studio bundle (about 140 KB raw) is precached by the service worker, so Studio works offline.
- The end-to-end suite has a `mobile` project (Pixel 7) that runs only `studio.spec.ts`.
