import { DeqError } from "@0xdolan/deq-core";
import { icons, rootAttributes } from "@0xdolan/deq-icons";
import type { DeqIcon as IconData, IconOptions } from "@0xdolan/deq-icons";
import { defineComponent, h } from "vue";
import type { DefineComponent, PropType, VNode } from "vue";

const iconProps = {
  /** Width and height in px, or any CSS length. Default 24. */
  size: { type: [Number, String] as PropType<number | string>, default: undefined },
  /** Stroke and dot colour (CSS colour). Default `currentColor`. */
  color: { type: String, default: undefined },
  /** Stroke width in grid units. Default 2. */
  strokeWidth: { type: [Number, String] as PropType<number | string>, default: undefined },
  /** Keep the stroke `strokeWidth` px wide at any numeric `size`. */
  absoluteStrokeWidth: { type: Boolean, default: undefined },
  /** Accessible title. Default: the English name. `""` marks the icon decorative. */
  title: { type: String, default: undefined },
} as const;

/** Props of every Deq icon component; other attributes fall through to the `<svg>`. */
export type DeqIconProps = IconOptions;

function options(props: Readonly<Record<string, unknown>>): IconOptions {
  return Object.fromEntries(
    ["size", "color", "strokeWidth", "absoluteStrokeWidth", "title"]
      .map((k) => [k, props[k]])
      .filter(([, v]) => v !== undefined),
  ) as IconOptions;
}

function draw(icon: IconData, o: IconOptions, children: VNode[] | undefined): VNode {
  const label = o.title ?? icon.title;
  return h("svg", Object.fromEntries(rootAttributes(icon, o)), [
    ...(label === "" ? [] : [h("title", label)]),
    ...icon.node.map(([tag, attrs]) => h(tag, { ...attrs })),
    ...(children ?? []),
  ]);
}

/** A Deq icon component: the props of {@link DeqIconProps}, plus a default slot. */
export type DeqIconComponent = DefineComponent<typeof iconProps>;

/**
 * Make a typed component from icon data (`@0xdolan/deq-icons`). The generated components
 * use this; call it yourself for custom icon data.
 */
export function createDeqIcon(icon: IconData, name: string): DeqIconComponent {
  return defineComponent({
    name,
    props: iconProps,
    setup(props, { slots }) {
      return () => draw(icon, options(props), slots["default"]?.());
    },
  }) as DeqIconComponent;
}

/**
 * Any icon by catalog id: `<DeqIcon name="roj-half-sun" />`. It keeps every icon in the
 * bundle; import the named components (`RojHalfSun`) to tree-shake.
 *
 * @throws {DeqError} `UNKNOWN_SHAPE` for an id that is not in the catalog.
 */
export const DeqIcon = defineComponent({
  name: "DeqIcon",
  props: {
    /** Catalog id, for example `roj-half-sun`. */
    name: { type: String, required: true },
    ...iconProps,
  },
  setup(props, { slots }) {
    return () => {
      const icon = Object.hasOwn(icons, props.name) ? icons[props.name] : undefined;
      if (!icon) throw new DeqError("UNKNOWN_SHAPE", `unknown icon: ${props.name}`);
      return draw(icon, options(props), slots["default"]?.());
    };
  },
});
