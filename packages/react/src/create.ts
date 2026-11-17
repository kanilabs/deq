import { DeqError } from "@0xdolan/deq-core";
import { icons, rootAttributes } from "@0xdolan/deq-icons";
import type { DeqIcon as IconData, IconOptions } from "@0xdolan/deq-icons";
import { createElement } from "react";
import type { ComponentPropsWithRef, FunctionComponent, ReactElement } from "react";

/** Props of every Deq icon component; other SVG props pass through to the `<svg>`. */
export interface DeqIconProps
  extends IconOptions, Omit<ComponentPropsWithRef<"svg">, keyof IconOptions> {}

/** React prop name for an SVG attribute: `stroke-width` → `strokeWidth`. */
function propName(attr: string): string {
  if (attr.startsWith("aria-") || attr.startsWith("data-")) return attr;
  return attr.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

function svgProps(icon: IconData, options: IconOptions): Record<string, string> {
  return Object.fromEntries(rootAttributes(icon, options).map(([k, v]) => [propName(k), v]));
}

function draw(icon: IconData, props: DeqIconProps): ReactElement {
  const { size, color, strokeWidth, absoluteStrokeWidth, title, children, ...rest } = props;
  const options = Object.fromEntries(
    Object.entries({ size, color, strokeWidth, absoluteStrokeWidth, title }).filter(
      ([, v]) => v !== undefined,
    ),
  ) as IconOptions;
  const label = title ?? icon.title;
  return createElement(
    "svg",
    { ...svgProps(icon, options), ...rest },
    label === "" ? null : createElement("title", null, label),
    ...icon.node.map(([tag, attrs], key) =>
      createElement(
        tag,
        Object.fromEntries([
          ["key", key],
          ...Object.entries(attrs).map(([k, v]) => [propName(k), v]),
        ]),
      ),
    ),
    children,
  );
}

/**
 * Make a typed component from icon data (`@0xdolan/deq-icons`). The generated components
 * use this; call it yourself for custom icon data.
 */
export function createDeqIcon(
  icon: IconData,
  displayName: string,
): FunctionComponent<DeqIconProps> {
  const Component = (props: DeqIconProps): ReactElement => draw(icon, props);
  Component.displayName = displayName;
  return Component;
}

/** Props of {@link DeqIcon}: an icon picked by catalog id. */
export interface DeqIconByNameProps extends DeqIconProps {
  /** Catalog id, for example `roj-half-sun`. */
  readonly name: string;
}

/**
 * Any icon by catalog id: `<DeqIcon name="roj-half-sun" />`. It keeps every icon in the
 * bundle; import the named components (`RojHalfSun`) to tree-shake.
 *
 * @throws {DeqError} `UNKNOWN_SHAPE` for an id that is not in the catalog.
 */
export function DeqIcon({ name, ...props }: DeqIconByNameProps): ReactElement {
  const icon = Object.hasOwn(icons, name) ? icons[name] : undefined;
  if (!icon) throw new DeqError("UNKNOWN_SHAPE", `unknown icon: ${name}`);
  return draw(icon, props);
}
