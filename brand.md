# Capacity — Brand & UI Brief

## Typography
- Font: **Rethink Sans** (Google Fonts, self-host via next/font). Weights 400–800; NO 300 — light text renders at 400.
- Body letter-spacing: **-0.025em** (applies globally to body).
- Numerals: always `tabular-nums` for figures, KPIs, table values.
- Weights: body 400, labels/nav 500–600, KPI values 700.

## Colour — surfaces (neutral, no colour cast)
| Token | Light | Dark |
|---|---|---|
| background | `#f6f6f6` | `#0a0a0a` |
| card / popover | `#ffffff` | `#151515` |
| foreground | `#171717` | `#f5f5f5` |
| muted-foreground | `#6b6b6b` | `#8f8f8f` |
| border | `#e4e4e4` | `#262626` |
| secondary / muted | `#efefef` | `#1c1c1c` |

Dark is the default theme. Never use blue/teal-tinted greys.

## Colour — brand
Six presets only, no free colour picker. Default = **Capacity Blue `#1b63f8`**.
Each preset carries four values because one hex cannot be both a fill and legible text:

| Preset | Fill | Label on fill | Text (light bg) | Text (dark bg) |
|---|---|---|---|---|
| Capacity Blue | `#1b63f8` | `#ffffff` | `#1b63f8` | `#3b79f9` |
| Cyan | `#0e9bc4` | `#111111` | `#0b7fa1` | `#0e9bc4` |
| Violet | `#7c5cf0` | `#ffffff` | `#7c5cf0` | `#8669f1` |
| Orange | `#e27555` | `#111111` | `#b55e44` | `#e27555` |
| Emerald | `#12a37b` | `#111111` | `#0f8665` | `#12a37b` |
| Magenta | `#d1508a` | `#111111` | `#c04a7f` | `#d1508a` |

Rules:
- Brand is for **primary buttons, active nav, focus rings** only. Not for data, not for hovers.
- Brand as TEXT must use the mode-specific step (the fill often fails 4.5:1 as text).
- Hover surfaces = a faint wash of brand: `color-mix(in srgb, <brand> 8%, <card>)` light, `16%` dark. Never a solid brand block.

## Colour — charts (blue → light blue → purple)
| Slot | Light | Dark |
|---|---|---|
| 1 blue | `#1b63f8` | `#4d7bf3` |
| 2 light blue | `#0e88ad` | `#12a3bd` |
| 3 purple | `#7c5cf0` | `#9b7cf5` |
| 4 magenta (ext) | `#a8437a` | `#b8608f` |
| 5 amber (ext) | `#8a6a1f` | `#b08a2e` |

- Assign slots in fixed order, never cycle. Slots 1–3 cover almost everything.
- **Order is load-bearing**: blue and purple are the weakest pair for red-green colour blindness, so light blue sits between them. Never put blue and purple adjacent as two series.
- **No green, no red** in chart marks. Green/red are reserved for status text only (trend pills, with an arrow + sign so meaning is never colour-alone).
- Light and dark are separately stepped — dark is NOT a brightened light. Bright saturated fills glare on dark.

## Chart style
- Gridlines: horizontal only, `strokeDasharray="4 4"`, recessive. No vertical lines, no axis lines, no tick lines.
- Lines/areas: 2px stroke, no resting dots, active dot r=4 with a 2px surface-coloured ring.
- Areas: gradient fading top (28% opacity) → transparent.
- Bars: `radius=[4,4,0,0]`, max width ~56px. Stacked segments separated by a 2px surface-coloured edge.
- Tooltip: card surface, 8px radius, coloured dot + series name + right-aligned bold value. Crosshair (dashed) for line/area; band highlight for bars.
- Legend: dot + label, in the card header. Always present for 2+ series.
- Sparklines need 3px vertical margin or a zero value clips against the edge.
- Share-of-total → donut with the total in the hole, not a bar chart.

## Icons
- Library: **lucide-react** for static; **@animateicons/react** (`/lucide` subpath) for anything that should animate.
- Nav/interactive icons animate on hover of the **whole row**, not the glyph — attach a ref and drive `startAnimation()`/`stopAnimation()` from the parent `<a>`/`<button>`.
- 16px (`h-4 w-4`) in nav, 20px in larger rails.
- Social/brand glyphs: Simple Icons paths using `currentColor`.

## Shape & layout
- Radius: **8px** (`--radius`), cards/buttons/inputs alike.
- **Flat** — no shadows. Separation comes from `border` + card/background contrast.
- Logo: asterisk logomark, plain **black in light / white in dark** — never brand-coloured.

## Accessibility (non-negotiable)
- Body text ≥ 4.5:1; UI fills ≥ 3:1.
- Never encode meaning by colour alone — pair with icon, label or sign.
- Respect `prefers-reduced-motion`.
- Never branch rendering on theme during SSR (causes hydration mismatch) — swap with CSS `dark:` variants instead.
