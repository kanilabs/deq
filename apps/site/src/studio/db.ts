/**
 * Browser glue for "My shapes" (Phase 8c), exercised by the e2e suite: IndexedDB storage
 * and file downloads (also used by save and export, Phase 8d). In storage,
 * every record read back goes through parseCustomDef, and every failure resolves to
 * `undefined` so the Studio keeps the library in memory for the session instead.
 */
import { parseCustomDef, type CustomDef } from "./custom.ts";

const DB = "deq-studio";
const STORE = "shapes";

/** Persistent storage for custom shapes. */
export interface ShapeStore {
  all(): Promise<CustomDef[]>;
  put(def: CustomDef): Promise<void>;
  delete(id: string): Promise<void>;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

/** Open the store, or resolve to undefined when IndexedDB is unavailable or blocked. */
export async function openShapeStore(): Promise<ShapeStore | undefined> {
  try {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    const db = await done(request);
    const store = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
    return {
      async all() {
        const rows = await done(store("readonly").getAll());
        return rows.flatMap((row: unknown) => {
          try {
            return [parseCustomDef(row)];
          } catch {
            return [];
          }
        });
      },
      async put(def) {
        await done(store("readwrite").put(def));
      },
      async delete(id) {
        await done(store("readwrite").delete(id));
      },
    };
  } catch {
    return undefined;
  }
}

/** Offer `text` as a file download (a Blob URL, so nothing leaves the browser). */
export function downloadText(name: string, text: string, type = "application/json"): void {
  downloadFile(name, text, type);
}

/** Offer text or bytes as a file download. */
export function downloadFile(name: string, data: string | Uint8Array, type: string): void {
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
