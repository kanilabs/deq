import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { expect, it } from "vitest";

import App from "./App.vue";

it("renders three icons", async () => {
  const html = await renderToString(createSSRApp(App));
  expect(html.match(/<svg /g)).toHaveLength(3);
  expect(html).toContain('color="#ED2024"');
  expect(html).toContain('aria-hidden="true"');
});
