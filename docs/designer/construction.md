---
title: Reading a construction
description: What the Construction section on each icon page shows, and how to rebuild a shape from it by hand.
sidebar:
  order: 4
---

Every icon page on the website has a **Construction** section, built from the shape's file in [`spec/shapes/`](../../spec/shapes/). It shows everything you need to redraw the shape in any tool, at any size, with the same numbers the renderers use.

## What the section shows

- **The drawing.** The 24-unit grid with its centre lines, the keylines (circle, square, portrait and landscape rectangles) and the dashed live area, with the shape on top. Dots mark the centres of circles, arcs, stars and repeats.
- **Steps.** Plain-language construction steps with the maths behind each number: radii, angles, intersections and why each value was chosen.
- **Primitives.** One row per top-level part: its id, layer, primitive type and values. A note says when a part is drawn only for some parameter values.
- **Metrics.** Numbers computed from the shape at its default parameters.

## Primitive values

Values are written as in the spec, in grid units, with angles in degrees.

| Type         | Values                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `line`       | `x1 y1 x2 y2`: the two end points                                                                   |
| `circle`     | `cx cy r`: centre and radius                                                                        |
| `dot`        | `cx cy r`: a filled circle, radius 1 unless given                                                   |
| `arc`        | `cx cy r start end`: degrees clockwise from the positive x axis (3 o'clock)                         |
| `polyline`   | `points`: an open line through the points                                                           |
| `polygon`    | `points`: a closed outline                                                                          |
| `path`       | `d`: SVG path data, absolute `M L H V C Q Z` only; the numbers after `C` and `Q` are control points |
| `rect`       | `x y width height`                                                                                  |
| `ellipse`    | `cx cy rx ry`                                                                                       |
| `star`       | `cx cy points outerRadius innerRadius rotation`                                                     |
| `repeat`     | `count` copies of the element, each moved by `step`, or spread over `spread`                        |
| `radial`     | `count` copies about `center`, from `start` over `sweep` degrees                                    |
| `concentric` | `count` copies about `center`, copy i scaled by 1 − i × `scaleStep`                                 |
| `use`        | another shape, drawn at full size, with an optional `translate` or `rotate`                         |

`param rays` in place of a number means the value comes from the shape's parameter of that name. The **Parameters** section of the page lists them with their defaults. `filled` marks a part painted as a fill instead of a stroke.

A `radial` with sweep 360 spaces its copies 360 / count apart. With a smaller sweep, the first and last copies sit at the two ends. For example, the [half sun](https://kanilabs.github.io/deq/icons/roj-half-sun/) with 7 rays over 180° places them 30° apart.

## Metrics

| Metric           | Meaning                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| Visual box       | The box around the ink, strokes and round caps included: x, y, width × height |
| Bounding box     | The box around the centre lines, without the stroke                           |
| Optical centre   | The centre of the painted area, weighted by area                              |
| Stroke to size   | Stroke width (2) divided by the larger side of the visual box                 |
| Primitives drawn | How many basic parts the shape expands to at its defaults                     |

For a filled shape such as the Kurdish Sun, the two boxes are the same.

## Worked example: the Kurdish Sun

The [Kurdish Sun](https://kanilabs.github.io/deq/icons/kurdish-sun/#construction) is one `star` primitive with `points param rays` (21 by default), so it has two rows, one per variant:

1. Draw a star with 21 outer and 21 inner points, the first outer point straight up (rotation −90°).
2. Outer radius R = 20 / (1 + cos(π/21)) = 10.056, so the star is exactly 20 units tall. Inner radius R / 2 = 5.028.
3. Centre (12, 12.056): the star reaches R above its centre but only R cos(π/21) below, so the centre moves down 0.056 to centre the box from 2 to 22. [Optical corrections](optical-corrections.md) explains why.
4. For the outline variant, use R − 1 and R/2 − 0.5 (9.056 and 4.528) with a 2-unit stroke, so the outer edge matches the filled star.

## Redrawing a shape in another tool

1. Make a 24 × 24 document (pixels or points) and turn on a 1-unit grid. The [tool guides](../tools/inkscape.md) show how in each app.
2. Draw each primitive from its values. Circles and arcs need a centre and radius; most apps take a bounding box, so use x = cx − r, y = cy − r and width = height = 2r.
3. Set the stroke to 2 with round caps and joins, and draw dots as filled circles of radius 1.
4. Compare with the SVG from the icon page's **Download SVG** link. It is usually quicker to start from that file, or from a layered SVG export, which has one group per layer.

## Next

- [Spacing and composition](composition.md)
- [Colour and accessibility](colour.md)
