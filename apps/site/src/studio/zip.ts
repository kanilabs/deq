/**
 * A small ZIP writer for multi-file exports (Phase 8d). Entries are deflated with the
 * platform's `CompressionStream("deflate-raw")`, or stored when that does not make them
 * smaller, so no dependency is needed. Names are UTF-8 (general purpose bit 11).
 */

export interface ZipEntry {
  /** A plain file name: no folders, no `..`. */
  readonly name: string;
  readonly data: string | Uint8Array;
}

export class ZipError extends Error {
  override name = "ZipError";
}

/** At most this many entries, as the exporters accept at most 512 items. */
export const MAX_ZIP_ENTRIES = 4096;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xff_ff_ff_ff;
  for (const byte of data) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xff_ff_ff_ff) >>> 0;
}

/** Deflate-raw through the platform's compression stream. */
export async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** MS-DOS time and date fields (local time, two-second resolution, from 1980). */
function dosDateTime(date: Date): [number, number] {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return [time, day];
}

function checkName(name: string): void {
  if (
    name.length === 0 ||
    name.length > 255 ||
    /[/\\:\0]/u.test(name) ||
    name === "." ||
    name === ".."
  ) {
    throw new ZipError(`zip: bad file name ${JSON.stringify(name.slice(0, 80))}`);
  }
}

/**
 * Pack `entries` into a ZIP archive.
 *
 * @throws {ZipError} for an empty list, too many entries, bad or duplicate names.
 */
export async function zip(entries: readonly ZipEntry[], date = new Date()): Promise<Uint8Array> {
  if (entries.length === 0 || entries.length > MAX_ZIP_ENTRIES) {
    throw new ZipError(`zip: give 1 to ${String(MAX_ZIP_ENTRIES)} files`);
  }
  const seen = new Set<string>();
  const encoder = new TextEncoder();
  const [time, day] = dosDateTime(date);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    checkName(entry.name);
    const key = entry.name.toLowerCase();
    if (seen.has(key)) throw new ZipError(`zip: duplicate file name ${entry.name}`);
    seen.add(key);
    const name = encoder.encode(entry.name);
    const raw = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(raw);
    const deflated = await deflateRaw(raw);
    const stored = deflated.length >= raw.length;
    const body = stored ? raw : deflated;
    const header = (central: boolean): Uint8Array => {
      const size = central ? 46 : 30;
      const h = new Uint8Array(size + name.length);
      const v = new DataView(h.buffer);
      let p = 0;
      v.setUint32(p, central ? 0x02_01_4b_50 : 0x04_03_4b_50, true);
      p += 4;
      if (central) {
        v.setUint16(p, 20, true); // version made by
        p += 2;
      }
      v.setUint16(p, 20, true); // version needed
      v.setUint16(p + 2, 0x08_00, true); // UTF-8 names
      v.setUint16(p + 4, stored ? 0 : 8, true);
      v.setUint16(p + 6, time, true);
      v.setUint16(p + 8, day, true);
      v.setUint32(p + 10, crc, true);
      v.setUint32(p + 14, body.length, true);
      v.setUint32(p + 18, raw.length, true);
      v.setUint16(p + 22, name.length, true);
      // Extra field length 0; in the central header also comment, disk, attributes: 0.
      if (central) v.setUint32(p + 36, offset, true);
      h.set(name, size);
      return h;
    };
    const local = header(false);
    locals.push(local, body);
    centrals.push(header(true));
    offset += local.length + body.length;
  }
  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const v = new DataView(end.buffer);
  v.setUint32(0, 0x06_05_4b_50, true);
  v.setUint16(8, entries.length, true);
  v.setUint16(10, entries.length, true);
  v.setUint32(12, centralSize, true);
  v.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let p = 0;
  for (const part of parts) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}
