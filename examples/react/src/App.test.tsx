import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { App } from "./App.tsx";

it("renders three icons", () => {
  const html = renderToStaticMarkup(<App />);
  expect(html.match(/<svg /g)).toHaveLength(3);
  expect(html).toContain('color="#ED2024"');
  expect(html).toContain('aria-hidden="true"');
});
