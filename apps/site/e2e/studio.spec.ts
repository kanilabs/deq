import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Studio. Phase 8a: canvas, library, inspector, history, view, overlays and shortcuts.
 * Phase 8b: multi-select, batch editing, align and distribute, groups, layer order, lock
 * and hide, and the layers panel. Phase 8c: the shape editor (parts, booleans, mirror,
 * arrays, the path editor) and "My shapes" (save, place, export, import, edit, delete).
 */
const LOCALES = [
  { prefix: "", lang: "en", dir: "ltr" },
  { prefix: "ckb/", lang: "ckb", dir: "rtl" },
  { prefix: "kmr/", lang: "kmr", dir: "ltr" },
] as const;

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 960;

async function watchCsp(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy/iu.test(msg.text())) problems.push(msg.text());
  });
  page.on("pageerror", (err) => problems.push(err.message));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`Content Security Policy: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  return problems;
}

async function open(page: Page, prefix = ""): Promise<void> {
  await page.goto(`${prefix}studio/`);
  await expect(page.locator(".studio.ready")).toBeVisible();
}

/** Show a pane on narrow screens; on wide screens every pane is visible. */
async function show(page: Page, pane: "library" | "canvas" | "inspector"): Promise<void> {
  if (mobile(page)) await page.locator(`.tabs button[aria-controls="studio-pane-${pane}"]`).click();
}

async function addSun(page: Page): Promise<void> {
  await show(page, "library");
  await page.locator('.tile[data-shape="kurdish-sun"]').click();
  await expect(page.locator("[data-item]")).toHaveCount(1);
}

const items = (page: Page) => page.locator("[data-item]");
const pressed = (page: Page) => page.locator('[data-item][aria-pressed="true"]');
const tool = (page: Page, action: string) => page.locator(`.inspector [data-action="${action}"]`);

/** Add the Kurdish Sun `n` times; new shapes are placed side by side. */
async function addSuns(page: Page, n: number): Promise<void> {
  for (let k = 1; k <= n; k++) {
    await show(page, "library");
    await page.locator('.tile[data-shape="kurdish-sun"]').click();
    await expect(items(page)).toHaveCount(k);
  }
}

/** Select every shape from the keyboard. */
async function selectAll(page: Page): Promise<void> {
  await show(page, "canvas");
  await items(page).first().focus();
  await page.keyboard.press("ControlOrMeta+a");
}

/** Canvas positions of the shapes, read from their transforms (works while the pane is hidden). */
async function boxes(page: Page): Promise<{ x: number; y: number }[]> {
  const transforms = await items(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("transform") ?? ""),
  );
  return transforms.map((t) => {
    const [x = NaN, y = NaN] = (/translate\(([^ ]+) ([^)]+)\)/u.exec(t) ?? []).slice(1).map(Number);
    return { x, y };
  });
}

async function showLayers(page: Page): Promise<void> {
  await show(page, "library");
  await page.locator('[data-side="layers"]').click();
  await expect(page.locator(".layers")).toBeVisible();
}
const option = (page: Page, key: string) => page.locator(`[data-option="${key}"]`);

test.beforeEach(async ({ context }) => {
  // Every test starts with an empty, unsaved design.
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("deq-e2e")) {
      localStorage.clear();
      sessionStorage.setItem("deq-e2e", "1");
    }
  });
});

for (const locale of LOCALES) {
  test(`${locale.lang} studio: lang, dir, CSP, axe with a shape selected`, async ({ page }) => {
    const problems = await watchCsp(page);
    await open(page, locale.prefix);
    await expect(page.locator("html")).toHaveAttribute("lang", locale.lang);
    await expect(page.locator("html")).toHaveAttribute("dir", locale.dir);
    await addSun(page);
    for (const pane of ["canvas", "inspector", "library"] as const) {
      await show(page, pane);
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        axe.violations
          .filter((v) => v.impact === "serious" || v.impact === "critical")
          .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
      ).toEqual([]);
      if (!mobile(page)) break;
    }
    expect(problems).toEqual([]);
  });
}

test("library search filters shapes and announces the count", async ({ page }) => {
  await open(page);
  await show(page, "library");
  const tiles = page.locator(".tile[data-shape]");
  const all = await tiles.count();
  expect(all).toBeGreaterThan(50);
  await page.getByRole("searchbox").fill("sun");
  await expect.poll(() => tiles.count()).toBeLessThan(all);
  await expect(page.locator(".library [role=status]")).toContainText(String(await tiles.count()));
  await page.getByRole("searchbox").fill("zzzz-no-match");
  await expect(tiles).toHaveCount(0);
});

test("adding, editing, resetting, undo and redo", async ({ page }) => {
  await open(page);
  await addSun(page);
  await show(page, "inspector");

  const size = option(page, "size").locator("input.num");
  await size.fill("48");
  await expect(option(page, "size")).toHaveClass(/changed/u);
  await expect(items(page).locator("svg").first()).toHaveAttribute("width", "48");

  const color = option(page, "color").locator("input.text");
  await color.fill("url(#x)");
  await color.press("Enter");
  await expect(page.getByRole("alert")).toBeVisible();
  await color.fill("#cc0000");
  await color.press("Enter");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(option(page, "color")).toHaveClass(/changed/u);

  await option(page, "color").locator("button.reset").click();
  await expect(option(page, "color")).not.toHaveClass(/changed/u);

  await page.locator('[data-action="reset-shape"]').click();
  await expect(option(page, "size")).not.toHaveClass(/changed/u);

  await page.locator('.toolbar [data-action="undo"]').click();
  await expect(option(page, "size")).toHaveClass(/changed/u);
  await page.locator('.toolbar [data-action="redo"]').click();
  await expect(option(page, "size")).not.toHaveClass(/changed/u);

  // Keyboard undo from the canvas removes the shape again, step by step.
  await show(page, "canvas");
  await items(page).first().focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press("ControlOrMeta+z");
  await expect(items(page)).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(items(page)).toHaveCount(1);
});

test("duplicate, delete, nudge and select all from the keyboard", async ({ page }) => {
  await open(page);
  await addSun(page);
  await show(page, "canvas");
  const first = items(page).first();
  await first.focus();
  const label = await first.getAttribute("aria-label");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(first).not.toHaveAttribute("aria-label", label ?? "");
  await page.keyboard.press("ControlOrMeta+d");
  await expect(items(page)).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+a");
  await expect(page.locator('[data-item][aria-pressed="true"]')).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(items(page)).toHaveCount(0);
});

test("the design is saved and restored after a reload", async ({ page }) => {
  await open(page);
  await addSun(page);
  await page.reload();
  await expect(page.locator(".studio.ready")).toBeVisible();
  await show(page, "canvas");
  await expect(items(page)).toHaveCount(1);
});

test("zoom buttons, fit and overlays", async ({ page }) => {
  await open(page);
  await addSun(page);
  await show(page, "canvas");
  const zoom = page.locator('.toolbar [data-action="zoomReset"]');
  const before = await zoom.textContent();
  await page.locator('.toolbar [data-action="zoomIn"]').click();
  await expect(zoom).not.toHaveText(before ?? "");
  await zoom.click();
  await expect(zoom).toHaveText("100%");
  await page.locator('.toolbar [data-action="zoomFit"]').click();
  await expect(zoom).not.toHaveText("100%");

  for (const [key, selector] of [
    ["keylines", ".keylines"],
    ["pixels", ".pixels"],
  ] as const) {
    const toggle = page.locator(`[data-toggle="${key}"]`);
    await expect(page.locator(selector)).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(selector)).toHaveCount(1);
  }
  const rulers = page.locator('[data-toggle="rulers"]');
  const visible = (await rulers.getAttribute("aria-pressed")) === "true";
  await rulers.click();
  await expect(page.locator(".ruler-x")).toHaveCount(visible ? 0 : 1);
});

test("dragging moves a shape and the wheel zooms the canvas", async ({ page }) => {
  test.skip(mobile(page), "pointer drag is a desktop interaction; mobile uses tap and nudge");
  await open(page);
  await addSun(page);
  const item = items(page).first();
  const label = await item.getAttribute("aria-label");
  const box = await item.boundingBox();
  if (!box) throw new Error("no item box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 80, { steps: 8 });
  await page.mouse.up();
  await expect(item).not.toHaveAttribute("aria-label", label ?? "");
  await page.locator('.toolbar [data-action="undo"]').click();
  await expect(item).toHaveAttribute("aria-label", label ?? "");

  const zoom = page.locator('.toolbar [data-action="zoomReset"]');
  const before = await zoom.textContent();
  await page.mouse.move(box.x - 100, box.y + 100);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect(zoom).not.toHaveText(before ?? "");
});

test("a library tile can be dropped on the canvas", async ({ page }) => {
  test.skip(mobile(page), "drag and drop needs a pointer; mobile adds with a tap");
  await open(page);
  await page
    .locator('.tile[data-shape="kurdish-sun"]')
    .dragTo(page.locator(".surface"), { targetPosition: { x: 200, y: 200 } });
  await expect(items(page)).toHaveCount(1);
});

test("shortcuts are listed, remappable and persist", async ({ page }) => {
  await open(page);
  await show(page, "canvas");
  await page.locator('.toolbar [data-action="help"]').click();
  const dialog = page.locator("dialog.shortcuts");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("tbody tr")).toHaveCount(41);

  await dialog.locator('tr[data-action="toggleGrid"] button').click();
  await expect(dialog.locator(".status")).not.toBeEmpty();
  await page.keyboard.press("x");
  await expect(dialog.locator('tr[data-action="toggleGrid"] kbd')).toHaveText("X");
  await dialog.locator("header button").click();
  await expect(dialog).toBeHidden();

  const grid = page.locator('[data-toggle="grid"]');
  const pressed = await grid.getAttribute("aria-pressed");
  await page.locator(".surface").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("x");
  await expect(grid).not.toHaveAttribute("aria-pressed", pressed ?? "");

  await page.reload();
  await expect(page.locator(".studio.ready")).toBeVisible();
  await page.keyboard.press("?");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('tr[data-action="toggleGrid"] kbd')).toHaveText("X");
  await dialog.locator("footer button").click();
  await expect(dialog.locator('tr[data-action="toggleGrid"] kbd')).toHaveText("G");
});

test("mobile tabs show one pane at a time", async ({ page }) => {
  test.skip(!mobile(page), "the tab bar only shows on narrow screens");
  await open(page);
  const tabs = page.locator(".tabs button");
  await expect(tabs).toHaveCount(3);
  await expect(page.locator(".pane-canvas")).toBeVisible();
  await expect(page.locator(".pane-library")).toBeHidden();
  await show(page, "library");
  await expect(page.locator(".pane-library")).toBeVisible();
  await expect(page.locator(".pane-canvas")).toBeHidden();
  // Adding a shape returns to the canvas.
  await page.locator('.tile[data-shape="kurdish-sun"]').click();
  await expect(page.locator(".pane-canvas")).toBeVisible();
  await show(page, "inspector");
  await expect(option(page, "size")).toBeVisible();
  const box = await page.locator(".studio").boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1);
});

test("studio works offline once cached", async ({ page, context }) => {
  await page.goto("");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await open(page);
  await addSun(page);
  await context.setOffline(false);
});

test("shift-click and select all pick several shapes for batch editing", async ({ page }) => {
  await open(page);
  await addSuns(page, 2);
  await show(page, "canvas");
  await items(page).first().focus();
  await show(page, "inspector");
  await option(page, "size").locator("input.num").fill("48");

  await selectAll(page);
  await expect(pressed(page)).toHaveCount(2);
  await show(page, "inspector");
  await expect(page.locator(".inspector .count")).toContainText("2");
  const size = option(page, "size").locator("input.num");
  await expect(size).toHaveValue("");
  await expect(size).toHaveAttribute("placeholder", "Mixed");
  await expect(option(page, "size")).toHaveClass(/mixed/u);

  // One edit changes every selected shape and is one undo step.
  const color = option(page, "color").locator("input.text");
  await color.fill("#cc0000");
  await color.press("Enter");
  await expect(option(page, "color")).not.toHaveClass(/mixed/u);
  await expect(color).toHaveValue("#cc0000");
  await size.fill("32");
  await expect(option(page, "size")).not.toHaveClass(/mixed/u);
  await expect(items(page).locator("svg[width='32']")).toHaveCount(2);
  await page.locator('.toolbar [data-action="undo"]').click();
  await expect(option(page, "size")).toHaveClass(/mixed/u);

  // Shift-click needs a pointer and a keyboard.
  if (mobile(page)) return;
  await page.locator(".surface").click({ position: { x: 5, y: 5 } });
  await expect(pressed(page)).toHaveCount(0);
  await items(page).nth(0).click();
  await items(page)
    .nth(1)
    .click({ modifiers: ["Shift"] });
  await expect(pressed(page)).toHaveCount(2);
  await items(page)
    .nth(0)
    .click({ modifiers: ["Shift"] });
  await expect(pressed(page)).toHaveCount(1);
});

test("a marquee drag selects shapes and Space-drag pans", async ({ page }) => {
  test.skip(mobile(page), "touch drags pan; the marquee needs a mouse or pen");
  await open(page);
  await addSuns(page, 3);
  await page.locator(".surface").click({ position: { x: 5, y: 5 } });
  const first = await items(page).nth(0).boundingBox();
  const second = await items(page).nth(1).boundingBox();
  if (!first || !second) throw new Error("no item box");
  await page.mouse.move(first.x - 20, first.y - 20);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2, second.y + second.height + 20, { steps: 6 });
  await expect(page.locator(".marquee")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator(".marquee")).toHaveCount(0);
  await expect(pressed(page)).toHaveCount(2);
  await expect(page.locator(".bounds")).toHaveCount(1);

  // Holding Space turns the same drag into a pan: the shapes move on screen, not in the design.
  const before = await items(page).first().boundingBox();
  const label = await items(page).first().getAttribute("aria-label");
  await page.mouse.move(first.x - 20, first.y + 60);
  await page.keyboard.down(" ");
  await page.mouse.down();
  await page.mouse.move(first.x + 80, first.y + 60, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up(" ");
  expect((await items(page).first().boundingBox())?.x).toBeGreaterThan((before?.x ?? 0) + 50);
  await expect(items(page).first()).toHaveAttribute("aria-label", label ?? "");
  await expect(pressed(page)).toHaveCount(2);
});

test("align, distribute, group, lock and hide from the inspector", async ({ page }) => {
  await open(page);
  await addSuns(page, 3);
  // Move the first shape down so the shapes are not lined up.
  await show(page, "canvas");
  await items(page).first().focus();
  for (let k = 0; k < 3; k++) await page.keyboard.press("Shift+ArrowDown");

  await show(page, "inspector");
  await expect(tool(page, "alignTop")).toBeDisabled();
  await selectAll(page);
  await show(page, "inspector");
  await expect(tool(page, "distributeH")).toBeEnabled();
  await tool(page, "alignTop").click();
  await expect.poll(async () => new Set((await boxes(page)).map((b) => b.y)).size).toBe(1);
  await tool(page, "alignLeft").click();
  await expect.poll(async () => new Set((await boxes(page)).map((b) => b.x)).size).toBe(1);
  await page.locator('.toolbar [data-action="undo"]').click();
  await expect.poll(async () => new Set((await boxes(page)).map((b) => b.x)).size).toBe(3);
  await tool(page, "distributeH").click();

  await tool(page, "group").click();
  await expect(tool(page, "ungroup")).toBeEnabled();
  await expect(tool(page, "group")).toBeDisabled();
  // Focusing one member selects the whole group.
  await show(page, "canvas");
  await page.keyboard.press("Escape");
  await expect(pressed(page)).toHaveCount(0);
  await items(page).nth(1).focus();
  await expect(pressed(page)).toHaveCount(3);
  await expect(page.locator(".group-box")).toHaveCount(1);

  await show(page, "inspector");
  await tool(page, "toggleLock").click();
  await expect(tool(page, "toggleLock")).toHaveAttribute("aria-pressed", "true");
  await show(page, "canvas");
  await items(page).first().focus();
  await page.keyboard.press("Delete");
  await expect(items(page)).toHaveCount(3);
  await page.keyboard.press("ControlOrMeta+Shift+l");
  await show(page, "inspector");
  await expect(tool(page, "toggleLock")).toHaveAttribute("aria-pressed", "false");

  await tool(page, "ungroup").click();
  await expect(tool(page, "ungroup")).toBeDisabled();
  await tool(page, "toggleHide").click();
  await expect(items(page)).toHaveCount(0);
  await page.locator('.toolbar [data-action="undo"]').click();
  await expect(items(page)).toHaveCount(3);
});

test("the layers panel selects, reorders, locks and hides shapes", async ({ page }) => {
  await open(page);
  await addSuns(page, 2);
  await showLayers(page);
  const rows = page.locator(".layer-row");
  await expect(rows).toHaveCount(2);
  // Top of the stack first.
  await expect(rows.nth(0)).toHaveAttribute("data-id", "i2");
  await expect(rows.nth(0).locator('[data-move="up"]')).toBeDisabled();

  await rows.nth(0).locator('[data-move="down"]').click();
  await expect(rows.nth(0)).toHaveAttribute("data-id", "i1");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows.nth(0)).toHaveAttribute("data-id", "i2");

  await rows.nth(0).locator(".pick").click();
  await rows
    .nth(1)
    .locator(".pick")
    .click({ modifiers: ["Shift"] });
  await expect(rows.locator('.pick[aria-pressed="true"]')).toHaveCount(2);
  await expect(pressed(page)).toHaveCount(2);

  // Keyboard layer order: send the selection's top shape to the back.
  await rows.nth(0).locator(".pick").click();
  await page.keyboard.press("ControlOrMeta+Shift+ArrowDown");
  await expect(rows.nth(1)).toHaveAttribute("data-id", "i2");

  await page.keyboard.press("ControlOrMeta+g");
  await expect(rows.locator(".tag")).toHaveCount(0);
  await rows
    .nth(0)
    .locator(".pick")
    .click({ modifiers: ["Shift"] });
  await page.keyboard.press("ControlOrMeta+g");
  await expect(rows.locator(".tag")).toHaveCount(2);

  const lock = rows.nth(0).locator('[data-flag="locked"]');
  await lock.click();
  await expect(lock).toHaveAttribute("aria-pressed", "true");
  const hide = rows.nth(0).locator('[data-flag="hidden"]');
  await hide.click();
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await expect(items(page)).toHaveCount(1);

  const axe = await new AxeBuilder({ page })
    .include(".layers")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
    [],
  );
});

// Phase 8c: custom shapes ---------------------------------------------------------------

const editor = (page: Page) => page.getByRole("dialog");
const parts = (page: Page) => editor(page).locator(".parts button");
const mine = (page: Page) => page.locator(".mine-tile");

async function newShape(page: Page): Promise<void> {
  await show(page, "library");
  await page.locator('[data-action="new-shape"]').click();
  await expect(editor(page)).toBeVisible();
}

/** Page coordinates of grid point (gx, gy) on the editor's 24-unit grid. */
async function gridPoint(page: Page, gx: number, gy: number): Promise<{ x: number; y: number }> {
  const box = await editor(page).locator(".overlay").boundingBox();
  if (!box) throw new Error("no editor grid");
  return { x: box.x + ((gx + 0.5) / 25) * box.width, y: box.y + ((gy + 0.5) / 25) * box.height };
}

test("the shape editor combines parts and saves a shape that persists", async ({ page }) => {
  const problems = await watchCsp(page);
  await open(page);
  await newShape(page);
  const axe = await new AxeBuilder({ page })
    .include(".editor")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => v.id),
  ).toEqual([]);

  // A circle moved off-centre, then a square: unite them into one path.
  await editor(page).locator('[data-part="circle"]').click();
  await expect(parts(page)).toHaveCount(1);
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(editor(page).locator('[data-field="cx"]')).toHaveValue("16");
  await editor(page).locator('[data-part="rect"]').click();
  await page.keyboard.press("ControlOrMeta+a");
  await expect(editor(page).locator('.parts [aria-pressed="true"]')).toHaveCount(2);
  await editor(page).locator('[data-bool="unite"]').click();
  await expect(parts(page)).toHaveCount(1);
  await expect(parts(page).first()).toHaveText("Path");

  // The path editor: pick a point, add one after it, undo.
  const anchors = editor(page).locator('.overlay [data-k="end"]');
  const before = await anchors.count();
  expect(before).toBeGreaterThan(3);
  // Corners of a boolean result can stack two anchors; either one will do.
  await anchors.nth(1).click({ force: true });
  await editor(page).locator('[data-tool="addPoint"]').click();
  await expect(anchors).toHaveCount(before + 1);
  await editor(page).getByRole("button", { name: "Undo" }).click();
  await expect(anchors).toHaveCount(before);

  // Booleans need closed parts.
  await editor(page).locator('[data-part="line"]').click();
  await page.keyboard.press("ControlOrMeta+a");
  await editor(page).locator('[data-bool="subtract"]').click();
  await expect(editor(page).locator(".note")).toContainText("closed parts");
  await page.keyboard.press("Delete");
  await expect(parts(page)).toHaveCount(0);
  await editor(page).getByRole("button", { name: "Undo" }).click();
  await expect(parts(page)).toHaveCount(2);

  // Mirror a copy and wrap one part into a radial array, then unwrap it.
  await parts(page).last().click();
  await editor(page).locator('[data-tool="mirrorH"]').click();
  await expect(parts(page)).toHaveCount(3);
  await editor(page).locator('[data-part="dot"]').click();
  await editor(page).locator('[data-tool="radial"]').click();
  await expect(parts(page).first()).toHaveText("Radial array");
  await editor(page).locator('[data-tool="unwrap"]').click();
  await expect(parts(page).first()).toHaveText("Dot");

  await editor(page).getByLabel("Name").fill("Moon gate");
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(editor(page)).toBeHidden();
  await expect(mine(page)).toHaveCount(1);
  await expect(mine(page).locator(".name")).toHaveText("Moon gate");
  await expect(mine(page).locator(".glyph svg")).toHaveCount(1);

  // Place it like a catalog shape; both the library and the design survive a reload.
  await mine(page).locator(".tile").click();
  await show(page, "canvas");
  await expect(items(page)).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".studio.ready")).toBeVisible();
  await show(page, "library");
  await expect(mine(page)).toHaveCount(1);
  await show(page, "canvas");
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator("svg")).toHaveCount(1);
  expect(problems).toEqual([]);
});

test("custom shapes export, import, edit and delete", async ({ page }) => {
  await open(page);
  await newShape(page);
  await editor(page).locator('[data-part="dot"]').click();
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(mine(page)).toHaveCount(1);

  const download = page.waitForEvent("download");
  await mine(page).locator('[data-action="export"]').click();
  const file = await (await download).path();
  const { readFile } = await import("node:fs/promises");
  const json = await readFile(file, "utf8");
  const spec = JSON.parse(json) as { id: string; category: string; primitives: unknown[] };
  expect(spec.id).toMatch(/^u-[a-z0-9]+$/u);
  expect(spec.category).toBe("compositions");
  expect(spec.primitives).toHaveLength(1);

  // Re-importing the same file adds a copy under a fresh id; bad files are refused.
  const input = page.locator('.mine input[type="file"]');
  await input.setInputFiles({
    name: "shape.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });
  await expect(mine(page)).toHaveCount(2);
  await input.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(page.locator(".studio > [role=status]")).toContainText("Could not import");
  await expect(mine(page)).toHaveCount(2);

  // Edit the first shape: placed copies follow the saved version.
  await mine(page).first().locator(".tile").click();
  await show(page, "library");
  await mine(page).first().locator('[data-action="edit"]').click();
  await expect(editor(page).getByRole("heading", { level: 2 })).toHaveText("Edit shape");
  await editor(page).locator('[data-part="line"]').click();
  await editor(page).getByRole("button", { name: "Save" }).click();
  await expect(editor(page)).toBeHidden();
  await expect(mine(page)).toHaveCount(2);

  // Deleting it from the library keeps the design's own copy.
  page.once("dialog", (d) => void d.accept());
  await show(page, "library");
  await mine(page).first().locator('[data-action="delete"]').click();
  await expect(mine(page)).toHaveCount(1);
  await show(page, "canvas");
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator("svg")).toHaveCount(1);
});

test("the shape editor drags parts and points and edits properties", async ({ page }) => {
  test.skip(
    mobile(page),
    "pointer drags are a desktop interaction; mobile uses taps, fields and arrow keys",
  );
  await open(page);
  await newShape(page);
  await editor(page).locator('[data-part="line"]').click();
  const x1 = editor(page).locator('[data-field="x1"]');
  await expect(x1).toHaveValue("6");

  // Drag the line by its middle, then drag its end point.
  const from = await gridPoint(page, 12, 12);
  const to = await gridPoint(page, 14, 10);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  await expect(x1).toHaveValue("8");
  await expect(editor(page).locator('[data-field="y1"]')).toHaveValue("10");
  const end = await gridPoint(page, 20, 10);
  const target = await gridPoint(page, 22, 4);
  await page.mouse.move(end.x, end.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  await expect(editor(page).locator('[data-field="x2"]')).toHaveValue("22");
  await expect(editor(page).locator('[data-field="y2"]')).toHaveValue("4");

  // Fields validate like the spec: off the grid is refused.
  await x1.fill("3");
  await x1.press("Tab");
  await expect(x1).toHaveValue("3");
  await x1.fill("40");
  await x1.press("Tab");
  await expect(editor(page).locator(".note")).toContainText("break the shape");

  // Escape clears the selection, then asks before discarding changes.
  await editor(page)
    .locator(".overlay")
    .click({ position: { x: 2, y: 2 } });
  page.once("dialog", (d) => void d.dismiss());
  await page.keyboard.press("Escape");
  await expect(editor(page)).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await editor(page).getByRole("button", { name: "Cancel" }).click();
  await expect(editor(page)).toBeHidden();
  await expect(mine(page)).toHaveCount(0);
});
