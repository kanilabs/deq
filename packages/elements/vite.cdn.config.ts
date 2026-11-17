/**
 * The CDN bundle: `dist/cdn/deq-elements.js`, one self-contained, minified ES module that
 * registers `<deq-icon>` when loaded. Built after `tsc`, from the published entry points.
 */
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/cdn",
    emptyOutDir: true,
    sourcemap: true,
    minify: true,
    rolldownOptions: { output: { minify: true } },
    lib: { entry: "src/define.ts", formats: ["es"], fileName: () => "deq-elements.js" },
  },
});
