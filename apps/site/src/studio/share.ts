/**
 * Share links (Phase 8d): the design is JSON, deflated, base64url-encoded and put in the URL
 * fragment (`#d=1.<data>`), so it never reaches a server. Links are size-capped, inflation
 * stops at a byte limit, and the result goes through `parseDoc` like any outside design.
 */
import { deflateRaw } from "./zip.ts";
import { parseDoc, type StudioDoc } from "./model.ts";

/** The fragment parameter and the format version in front of the data. */
export const SHARE_PARAM = "d";
const VERSION = "1.";
/** Longest encoded design, in characters (links stay usable in chats and mail). */
export const MAX_SHARE_CHARS = 16_000;
/** Largest design JSON a link may inflate to, in bytes. */
export const MAX_SHARE_JSON = 1_000_000;

export type ShareErrorCode = "large" | "invalid";

export class ShareError extends Error {
  override name = "ShareError";
  constructor(
    readonly code: ShareErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/u.test(text))
    throw new ShareError("invalid", "share link: bad characters");
  const bin = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Inflate, refusing output past `limit` bytes. */
async function inflateRaw(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new ShareError("large", "share link: the design is too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/**
 * Encode a design for a share link.
 *
 * @throws {ShareError} `large` when the link would be longer than {@link MAX_SHARE_CHARS}.
 */
export async function encodeShare(doc: StudioDoc): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(doc));
  const token = VERSION + toBase64Url(await deflateRaw(json));
  if (token.length > MAX_SHARE_CHARS) {
    throw new ShareError("large", "share link: the design is too large for a link");
  }
  return token;
}

/**
 * Decode and validate a shared design.
 *
 * @throws {ShareError} for long, corrupt or invalid data (the message says why).
 */
export async function decodeShare(token: string): Promise<StudioDoc> {
  if (token.length > MAX_SHARE_CHARS) throw new ShareError("large", "share link: too long");
  if (!token.startsWith(VERSION)) throw new ShareError("invalid", "share link: unknown version");
  let value: unknown;
  try {
    const json = await inflateRaw(fromBase64Url(token.slice(VERSION.length)), MAX_SHARE_JSON);
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json));
  } catch (error) {
    if (error instanceof ShareError) throw error;
    throw new ShareError("invalid", "share link: the data is damaged");
  }
  try {
    return parseDoc(value);
  } catch (error) {
    throw new ShareError("invalid", (error as Error).message);
  }
}

/** The share token in a location hash (`#d=…`), if any. */
export function shareToken(hash: string): string | undefined {
  const params = new URLSearchParams(hash.replace(/^#/u, ""));
  return params.get(SHARE_PARAM) ?? undefined;
}

/** A link to `base` (the Studio page, without a hash) that opens the design. */
export function shareUrl(base: string, token: string): string {
  const url = new URL(base);
  url.hash = `${SHARE_PARAM}=${token}`;
  return url.href;
}
