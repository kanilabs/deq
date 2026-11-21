/** An SVG child element: tag name and attributes, in the order core writes them. */
export type IconElement = readonly [
  tag: "circle" | "ellipse" | "line" | "path" | "polygon" | "polyline",
  attrs: Readonly<Record<string, string>>,
];

/** The elements of an icon, drawn in order inside a 24×24 view box. */
export type IconNode = readonly IconElement[];

/** One Deq shape as icon data, rendered with core's default options. */
export interface DeqIcon {
  /** Catalog id, for example `roj-half-sun`. */
  readonly name: string;
  /** English name, used as the default accessible title. */
  readonly title: string;
  readonly node: IconNode;
}

/**
 * The options icons support. They only change root attributes, so every icon keeps its
 * precomputed geometry. For dot scale, rotation, fills or parameters, use
 * `@0xdolan/deq-core` instead.
 */
export interface IconOptions {
  /** Width and height in px, or any CSS length. Default 24. */
  readonly size?: number | string;
  /** Stroke and dot colour (CSS colour). Default `currentColor`. */
  readonly color?: string;
  /** Stroke width in grid units. Default 2. */
  readonly strokeWidth?: number | string;
  /** Keep the stroke `strokeWidth` px wide at any numeric `size`. Default false. */
  readonly absoluteStrokeWidth?: boolean;
  /** Accessible title. Default: the English name. `""` marks the icon decorative. */
  readonly title?: string;
}
