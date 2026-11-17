const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function words(id: string): string[] {
  if (!ID.test(id)) throw new Error(`not an icon id: ${id}`);
  return id.split("-");
}

const upper = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);

/** The JavaScript export name of an icon: `roj-half-sun` → `rojHalfSun`. */
export function iconExportName(id: string): string {
  const [first = "", ...rest] = words(id);
  return first + rest.map(upper).join("");
}

/** The component name of an icon: `roj-half-sun` → `RojHalfSun`. */
export function iconComponentName(id: string): string {
  return words(id).map(upper).join("");
}
