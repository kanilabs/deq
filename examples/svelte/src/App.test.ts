import { render } from "svelte/server";
import { expect, it } from "vitest";

import App from "./App.svelte";

it("renders three icons", () => {
  const { body } = render(App);
  expect(body.match(/<svg /g)).toHaveLength(3);
  expect(body).toContain('color="#ED2024"');
  expect(body).toContain('aria-hidden="true"');
});
