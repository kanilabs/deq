import type { DeqIcon, IconOptions } from "@0xdolan/deq-icons";
import type { Snippet } from "svelte";
import type { SVGAttributes } from "svelte/elements";

/** Props of every Deq icon component; other SVG attributes pass through to the `<svg>`. */
export interface DeqIconProps
  extends IconOptions, Omit<SVGAttributes<SVGSVGElement>, keyof IconOptions | "children"> {
  /** Added inside the `<svg>`, after the shape. */
  children?: Snippet;
}

/** Props of `Icon`: icon data plus the usual props. */
export interface IconProps extends DeqIconProps {
  /** The icon data, for example `rojHalfSun` from `@0xdolan/deq-icons`. */
  icon: DeqIcon;
}

/** Props of `DeqIcon`: a catalog id plus the usual props. */
export interface DeqIconByNameProps extends DeqIconProps {
  /** Catalog id, for example `roj-half-sun`. */
  name: string;
}
