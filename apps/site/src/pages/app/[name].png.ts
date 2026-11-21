/** Web app icons for the manifest and iOS. */
import type { APIRoute, GetStaticPaths } from "astro";

import { appIcon } from "../../lib/images.ts";

const ICONS = {
  "icon-192": { size: 192, maskable: false },
  "icon-512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
  "apple-touch-icon": { size: 180, maskable: true },
} as const;

export const getStaticPaths = (() =>
  Object.entries(ICONS).map(([name, icon]) => ({
    params: { name },
    props: icon,
  }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ size: number; maskable: boolean }> = async ({ props }) =>
  new Response(await appIcon(props.size, props.maskable), {
    headers: { "Content-Type": "image/png" },
  });
