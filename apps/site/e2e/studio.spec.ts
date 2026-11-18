import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Studio (Phase 8a): canvas, library, inspector, history, view, overlays and shortcuts. */
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
  await expect(dialog.locator("tbody tr")).toHaveCount(25);

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
