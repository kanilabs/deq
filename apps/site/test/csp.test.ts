import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashInlineScripts } from "../integrations/csp.ts";

const hash = (s: string) => `'sha256-${createHash("sha256").update(s).digest("base64")}'`;
const page = (policy: string, body: string) =>
  `<head><meta http-equiv="content-security-policy" content="${policy}">${body}</head>`;

describe("hashInlineScripts", () => {
  it("adds the hashes of un-hashed inline scripts to script-src", () => {
    const known = "known()";
    const html = page(
      `default-src 'self'; script-src 'self' ${hash(known)}; style-src 'self'`,
      `<script>${known}</script><script>theme()</script><script type="module">a()</script>` +
        `<script type="application/ld+json">{"a":1}</script><script src="/x.js"></script>`,
    );
    const { html: out, added } = hashInlineScripts(html);
    expect(added).toBe(2);
    expect(out).toContain(
      `script-src 'self' ${hash(known)} ${hash("theme()")} ${hash("a()")}; style-src`,
    );
    expect(out).not.toContain(hash('{"a":1}'));
    expect(hashInlineScripts(out)).toEqual({ html: out, added: 0 });
  });

  it("creates script-src when the policy has none", () => {
    const { html } = hashInlineScripts(page("default-src 'self'", "<script>x()</script>"));
    expect(html).toContain(`default-src 'self';script-src 'self' ${hash("x()")}"`);
  });

  it("fails on a page without the CSP meta tag", () => {
    expect(() => hashInlineScripts("<script>x()</script>")).toThrow(/no CSP/u);
  });
});
