# FitPal Web Design System

Status: active for `apps/web`. Phase 1 visual foundations.

This document supersedes the previous charcoal and orange design guidance. It reflects the tokens and foundations implemented in Phase 1. Page layouts, copy, routes, navigation destinations and component structures were intentionally left in place.

## 1. Design philosophy

**Editorial minimalism for the overall identity. Athletic precision for the workout experience.**

The public website introduces the FitPal mobile product. It should read like a premium fitness journal: calm, confident, typographic and precise. The identity comes from deep burgundy fields, warm cream type, restrained surfaces and deliberate spacing, not from decorative effects.

Workout data should be structured, legible and tabular. Set rows, metrics and labels should align tightly and use clear hierarchy. Visual interest should come from composition and typography rather than glows, gradients, glass panels or perpetual motion.

## 2. Editorial minimalism and athletic precision

Editorial minimalism means:

- Generous margins and clear section rhythm.
- Strong headline hierarchy with tight tracking.
- Short, calm labels rather than loud badges.
- Restrained borders and dividers instead of heavy containers.
- One clear focal point per section.

Athletic precision means:

- Tabular numerals for sets, reps, weights, volume and timers.
- Aligned numeric columns and consistent label positions.
- Short, factual data labels.
- High contrast between values and support text.
- No decorative treatment that makes data harder to read.

## 3. Colour tokens

Exact values implemented in `apps/web/app/globals.css`.

| Token | CSS variable | Value | Purpose |
|---|---|---|---|
| wine-950 | `--wine-950` | `#1B050C` | Deepest background, device interiors |
| wine-900 | `--wine-900` | `#2A0812` | Primary page background |
| wine-800 | `--wine-800` | `#3A0D1A` | Alternating surfaces, cards |
| wine-700 | `--wine-700` | `#4A1424` | Secondary surface, logo tile |
| wine-600 | `--wine-600` | `#5C1B2D` | Elevated surface, selection |
| wine-500 | `--wine-500` | `#713047` | Hover and active surface |
| cream-100 | `--cream-100` | `#F7F0E4` | Primary text, primary button fill |
| cream-200 | `--cream-200` | `#EADFCB` | Secondary text, primary button hover |
| cream-300 | `--cream-300` | `#CBB99F` | Muted text |
| cream-400 | `--cream-400` | `#A89279` | Low-emphasis metadata |
| accent-clay | `--accent-clay` | `#C9795A` | Occasional data or state accent |
| accent-sand | `--accent-sand` | `#D9BE8A` | Small highlights, hover accents |
| focus | `--focus-ring` | `#F0D9AE` | Keyboard focus outline |

Additional tokens:

| Token | CSS variable | Value |
|---|---|---|
| Border | `--border-subtle` | `rgba(247, 240, 228, 0.14)` |
| Divider | `--divider-subtle` | `rgba(247, 240, 228, 0.10)` |
| Page background | `--background` | `var(--wine-900)` |
| Page foreground | `--foreground` | `var(--cream-100)` |

Colour rules:

- Burgundy is the dominant background.
- Cream is the primary text colour.
- Wine surfaces distinguish cards and sections.
- Clay is an occasional accent, not a dominant accent.
- Sand is used sparingly for focus, hover and small highlights.
- Do not introduce new accent colours without a documented reason.

## 4. Typography direction and fallback

The reference direction is a confident modern sans-serif identity. The exact Sweety font configuration is not present in the repository and was not installed in Phase 1.

Implemented fallback:

- Sans: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`
- Mono: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace`
- Tabular numerals are enabled globally with `font-variant-numeric: tabular-nums`.

Direction:

- Display headings: bold or semibold, tight tracking.
- Body: readable system sans-serif, comfortable line height.
- Small labels: restrained uppercase styling with `0.08em` letter spacing.
- Metrics: tabular numerals, high contrast values, muted labels.
- Do not introduce a serif display face.
- Do not install fonts or add font dependencies in this phase.

## 5. Spacing and layout grid

Implemented spacing scale in Tailwind's default 4px-based scale:

`4, 8, 12, 16, 24, 32, 48, 64, 96, 128px`

Tailwind utility equivalents:

`1, 2, 3, 4, 6, 8, 12, 16, 24, 32`

Grid direction:

- Desktop: 12 columns.
- Tablet: 8 columns.
- Mobile: 4 columns.
- Desktop grid gap: `32px` (`gap-8`).
- Mobile grid gap: `24px` (`gap-6`).

Use grid and spacing to create hierarchy. Do not add decoration to fill empty space.

## 6. Container widths and breakpoints

Implemented theme containers:

| Container | CSS variable | Width |
|---|---|---|
| Page | `--container-page` | `1200px` |
| Content | `--container-content` | `1120px` |
| Reading | `--container-reading` | `68ch` |

Tailwind mappings: `max-w-page`, `max-w-content`, `max-w-reading`.

Breakpoints:

| Name | Width |
|---|---:|
| sm | `640px` |
| md | `768px` |
| lg | `1024px` |
| xl | `1280px` |
| 2xl | `1440px` |

The `2xl` breakpoint is explicitly mapped in `@theme` to override Tailwind's larger default.

## 7. Cards and surface styling

Implemented component utilities:

- `.surface-card`: `wine-700` background, subtle border, `12px` radius.
- `.surface-raised`: `wine-600` background, subtle border, `12px` radius.
- `.eyebrow`: small uppercase label with wide letter spacing.
- `.tabular-data`: tabular numerals for numeric groups.

Rules:

- Large cards use `12px` radius.
- Small cards and controls use `6px` radius via `.rounded-control`.
- Borders are `1px` and use the subtle cream token.
- No default glow shadows.
- If a shadow is required, use `.shadow-surface`, which is soft and dark.
- Prefer flat surfaces and dividers over layered translucent panels.

## 8. Buttons and links

Implemented component utilities:

- `.button-primary`: cream fill, burgundy text, no glow, subtle cream hover.
- `.button-secondary`: transparent fill, cream hairline border, cream text.
- `.text-link`: cream text, underline offset `4px`, sand hover.

Rules:

- Primary actions use cream fill and burgundy text.
- Secondary actions use a transparent background and cream border.
- Text links are cream with an underline and sand hover.
- Do not use animated gradient buttons in new work.
- Do not change CTA wording or destinations as part of token work.

## 9. Borders, dividers and shadows

- Use `border-border` for subtle cream borders.
- Use `border-divider` and `divide-divider` for section rules and quiet separators.
- Use `1px` borders only.
- Do not use bright or high-contrast borders as the default.
- Do not use orange glow, neon glow or radial glow fields.
- Do not use large diffuse blurred colour fields.
- `.shadow-surface` is the only implemented shadow token and is intentionally restrained.

## 10. Focus and accessibility standards

Implemented:

- Global `:focus-visible` outline: `2px solid var(--focus-ring)` with `2px` offset.
- Visually hidden "Skip to content" link that appears on focus and targets `#main-content`.
- One `main` landmark per public route with `id="main-content"`.
- Global text colours that keep body copy readable on burgundy.
- No black text on burgundy backgrounds.
- Selection styling uses `wine-700` with `cream-100` text.

Standards:

- Every interactive element must have a visible focus state.
- Focus must not rely on colour alone.
- Hover states must be visible without changing layout.
- Muted text must remain readable against its surface.
- Headings and landmarks must remain semantic.
- Do not add decorative emojis to user-facing copy.
- Do not use em dashes in user-facing copy.

## 11. Reduced-motion principles

Implemented CSS foundation:

- `html` uses `scroll-behavior: smooth` by default.
- Under `prefers-reduced-motion: reduce`, smooth scrolling is disabled.
- CSS animation and transition durations are reduced to near zero.
- Non-essential CSS motion is disabled where safe.

Principles:

- Motion should support hierarchy and feedback, not fill space.
- Do not add infinite loops as decoration.
- Do not rely on motion to communicate essential state.
- JavaScript animation refactors are deferred to the dedicated motion phase.

## 12. Component design principles

Current component roles:

- Site header: quiet, non-glass surface with clear links and a visible CTA.
- Hero: large editorial headline, restrained description, focused device figure.
- Feature cards: flat, readable, typography-led surfaces.
- Phone and mockups: precise data displays with tabular values.
- CTA sections: clear primary and secondary actions with real focus states.
- Footer: low-emphasis metadata and navigation.

Principles:

- Prefer typography, composition and spacing over decorative effects.
- Keep workout data aligned and structured.
- Keep the public website focused on introducing the mobile product.
- Do not imply product capabilities that are not implemented.
- Do not redesign component layout during token work.
- Recolour existing effects rather than expanding their complexity.

Known Phase 1 limitation: `GlareCard`, `CometCard`, `NoiseBackground` and `CanvasText` retain their current interaction and animation structures. Their colours were migrated to the new palette. Full simplification or replacement belongs to later component and motion phases.

## 13. Responsive design principles

- Start from a 4-column mobile grid and expand at the defined breakpoints.
- Use one column for primary content on small screens.
- Keep line lengths comfortable and avoid dense numeric tables on narrow screens.
- Preserve tap targets and visible focus on all breakpoints.
- Use `24px` grid gaps on mobile and `32px` on desktop.
- Avoid horizontal overflow from fixed-width device mockups.
- Maintain the same hierarchy across web and mobile: headline, description, evidence, action.

## 14. Explicit avoid-list

Do not use:

- Orange glow.
- Neon gradients.
- Charcoal or near-black page backgrounds.
- Glassmorphism as a default treatment.
- Translucent floating decorative panels.
- Animated orange CTA gradients.
- Radial glow hero fields.
- Grid-line decorative backgrounds.
- Emoji as interface labels or decoration.
- Em dashes in user-facing copy.
- Animations added only to fill empty space.
- Generic AI-generated SaaS dashboard styling.
- Dense dashboards on the public marketing site.
- New accent colours without justification.

## 15. Relationship between web and mobile design language

Web and mobile should share the same identity:

- Deep burgundy backgrounds.
- Warm cream typography.
- Muted wine surfaces.
- Restrained borders and dividers.
- Confident modern sans-serif headings.
- Precise, tabular workout data.
- Calm, minimal visual effects.

Platform conventions still matter:

- Web uses wider editorial composition and responsive grids.
- Mobile uses focused screens, native spacing and touch-friendly controls.
- Navigation may adapt to each platform while preserving the same information structure.
- Motion should respect each platform's accessibility settings.

The design system documents the current implemented foundation and these shared rules. It does not document planned routes, unimplemented product capabilities or future page redesigns.
