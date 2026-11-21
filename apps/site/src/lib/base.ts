/** The site's base path, always with a trailing slash (`/deq/`). */
export const BASE: string = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
