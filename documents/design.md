# FitPal Web Design System

Status: active for `apps/web`. Phase 7 visual redesign.

This document describes the implemented public marketing system: tokens, typography, layout grid, components, motion and page composition. It supersedes the Phase 1 foundation notes where they differ. Copy, routes, navigation destinations and product claims were left unchanged by the redesign.

## 1. Design philosophy

**Editorial minimalism for the overall identity. Athletic precision for the workout experience.**

The public website introduces the FitPal mobile product. It should read like a premium fitness journal: calm, confident, typographic and precise. The identity comes from deep burgundy fields, warm cream type, hairline rules and deliberate spacing, not from decorative effects.

Workout data should be structured, legible and tabular. Set rows, metrics and labels align tightly and use clear hierarchy. Visual interest comes from composition and type rather than glows, gradients, glass panels or perpetual motion.

## 2. Editorial minimalism and athletic precision

Editorial minimalism means:

- Generous margins and a clear section rhythm.
- Strong headline hierarchy with tight tracking.
- Short, calm labels rather than loud badges.
- Ruled sections and hairline dividers instead of heavy containers.
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
| wine-800 | `--wine-800` | `#3A0D1A` | Panels, device bezel |
| wine-700 | `--wine-700` | `#4A1424` | Hover and secondary surface |
| wine-600 | `--wine-600` | `#5C1B2D` | Selection |
| wine-500 | `--wine-500` | `#713047` | Active surface |
| cream-100 | `--cream-100` | `#F7F0E4` | Primary text, primary button fill |
| cream-200 | `--cream-200` | `#EADFCB` | Body copy, primary button hover |
| cream-300 | `--cream-300` | `#CBB99F` | Muted text |
| cream-400 | `--cream-400` | `#A89279` | Labels and low-emphasis metadata |
| accent-clay | `--accent-clay` | `#C9795A` | Occasional data or state accent |
| accent-sand | `--accent-sand` | `#D9BE8A` | Small highlights |
| focus | `--focus-ring` | `#F0D9AE` | Keyboard focus outline |

Surface and rule tokens:

| Token | CSS variable | Value |
|---|---|---|
| Hairline | `--border-hairline` | `rgba(247, 240, 228, 0.12)` |
| Strong hairline | `--border-hairline-strong` | `rgba(247, 240, 228, 0.24)` |
| Divider | `--divider-subtle` | `rgba(247, 240, 228, 0.08)` |
| Page background | `--background` | `var(--wine-900)` |
| Page foreground | `--foreground` | `var(--cream-100)` |

Colour rules:

- Burgundy is the dominant background; cream is the primary text colour.
- Clay is an occasional accent for data, active indicators and emphasis, not a field colour.
- Sand is used sparingly.
- Hairline rules carry most of the structure. No glows, gradients or coloured fields.
- Measured contrast on wine-900: cream-100 16.2:1, cream-200 13.9:1, cream-300 9.6:1, cream-400 6.2:1, clay 5.6:1, sand 10.2:1.
- Do not introduce new accent colours without a documented reason.

## 4. Typography

Loaded with `next/font/google` in `apps/web/app/layout.tsx` and exposed as CSS variables.

| Role | Family | Variable |
|---|---|---|
| Display and headings | Plus Jakarta Sans | `--font-jakarta` |
| Body, labels, UI | Inter | `--font-inter` |
| Numeric fallback | system monospace | `--font-mono` |

Implemented utilities:

- `.type-display`: `clamp(2.5rem, 6.4vw, 4.25rem)`, 600, tracking `-0.03em`, leading `1.02`.
- `.type-headline`: `clamp(2rem, 3.8vw, 2.75rem)`, 600, tracking `-0.025em`.
- `.type-title`: `17px`, 600, tracking `-0.01em`.
- `.type-metric`: `clamp(1.75rem, 3vw, 2.25rem)`, tabular numerals.
- `.type-body-lg`: `17px`, leading `1.65`.
- `.type-body`: `15px`, leading `1.65`.
- `.type-small`: `13px`, cream-300.
- `.type-label` / `.type-eyebrow`: `11px`, 500, tracking `0.16em`, uppercase, cream-400.
- `.tabular-data`: tabular numerals.

Rules:

- Display face for headings and metrics; body face for paragraphs, labels and navigation.
- Headline tracking tightens as size grows. Labels are the only wide-tracked text.
- Body copy stays at comfortable line lengths; no justified text.
- Do not introduce a serif face.

## 5. Spacing and layout grid

Spacing follows Tailwind's 4px base scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128px`.

Layout:

- One editorial container: `.container-editorial`, max width `1240px`.
- Gutters: `24px` below `1024px`, `40px` from `1024px`.
- Desktop grid: 12 columns with `64px` gap (`gap-16`); tablet and mobile collapse to one or two columns.
- Section rhythm: `80px` to `112px` vertical spacing on desktop, roughly half that on mobile.
- Content is left-aligned; centred compositions are reserved for the rest timer page.

Hierarchy comes from grid span, rule placement and type scale, not from nested cards.

## 6. Breakpoints

| Name | Width |
|---|---:|
| sm | `640px` |
| md | `768px` |
| lg | `1024px` |
| xl | `1280px` |
| 2xl | `1440px` |

The `2xl` breakpoint is explicitly mapped in `@theme` to override Tailwind's larger default. Layout decisions are made at `sm`, `lg` and the natural 1240px container cap; intermediate widths should reflow without new breakpoints.

## 7. Surfaces and rules

Implemented utilities:

- `.panel`: hairline border, `16px` radius, translucent wine-800 fill.
- `.panel-cell`: hairline cell border for ruled grids.
- `.tabular-data`: numeric alignment.

Rules:

- Use `gap-px` grids over a hairline background for interior cell rules; do not stack borders that double up.
- Panels are used for product evidence, logbook records and grouped feature lists, not for every section.
- No drop shadows on cards. The only shadow is on the device bezel to seat it against the page.
- Radii: panels `16px`, devices `40px`, buttons and pills fully rounded, small controls `8px`.
- Borders are always `1px` hairlines.

## 8. Buttons and links

Implemented utilities:

- `.button-primary`: cream pill, wine-950 text, cream-200 hover, slight press scale.
- `.button-secondary`: transparent pill, strong hairline border, cream text, faint cream hover fill.
- `.text-link`: cream text with arrow icon; hover shifts to cream-300 and nudges the arrow.

Rules:

- Primary and secondary actions are pill-shaped and never wrap.
- Labels and destinations are fixed; design work must not change CTA wording.
- Hover and focus states must not shift layout.
- Icons are `lucide-react` line icons at the text's optical size.

## 9. Borders, dividers and shadows

- `border-hairline` for section rules, table rows and panel edges.
- `border-hairline-strong` for interactive outlines and the device bezel.
- `border-divider` for internal mockup separators only.
- No bright borders by default, no glow, no radial gradients, no blurred colour fields.
- The single shadow token is the device drop shadow in `PhoneMockup`.

## 10. Motion

Implemented:

- `MotionProvider` plus `MotionReveal` for entrance reveals.
- Reveals animate opacity and a short vertical offset only, once, and never loop.
- CSS smooth scrolling is enabled by default.
- Under `prefers-reduced-motion: reduce`, smooth scrolling is off, CSS transitions and animations are cut to near zero, and `[data-motion-reveal]` is forced to full opacity with no transform.
- A `<noscript>` rule makes revealed content visible without JavaScript.

Rules:

- Motion supports hierarchy and feedback only.
- No infinite decorative loops, parallax, floating cards or marquees.
- Never rely on motion to communicate state.
- Any new motion must degrade to a static layout under reduced motion.

## 11. Focus and accessibility

Implemented:

- Global `:focus-visible` outline: `2px solid var(--focus-ring)` with `3px` offset.
- Skip link to `#main-content`, visible on focus.
- One `main` landmark per route with `id="main-content"`.
- One `h1` per route; feature pages use `h2` for feature points.
- `aria-current="page"` on the active navigation item.
- Mobile menu: labelled trigger, `aria-expanded`, `aria-controls`, Escape to close with focus return, 44px targets.
- Anchor targets carry `scroll-mt-24` to clear the fixed header.
- Decorative icons are `aria-hidden`; no emoji in interface copy.

Standards:

- Every interactive element needs a visible focus state.
- Hover states must be visible without layout shift.
- Muted text must remain readable: no label below cream-400 on wine-900.
- Do not use em dashes in user-facing copy.

## 12. Components

- **Header** (`navbar.tsx`): fixed 64px bar, hairline bottom rule, logo, six feature links, primary "Get the App" pill, and a full-width mobile menu.
- **Footer** (`site-footer.tsx`): compact two-tier block with brand line, feature links, legal line and year.
- **Logo** (`fitpal-mark.tsx`): simplified geometric mark on a cream tile.
- **Device** (`phone-mockup.tsx`): `264px` mobile, `300px` from `sm`; one bezel, one shadow. Exports one mockup per feature plus `HeroSessionMockup`, all preserving the original preview strings.
- **FeatureIntro** (`feature-intro.tsx`): shared eyebrow, `h1` and body with `stacked`, `split` and `centered` variants.
- **SiteCta** (`site-cta.tsx`): shared closing panel with fixed heading, supporting line and page-specific actions.
- **MotionReveal** (`motion-reveal.tsx`): the only entrance animation primitive.

Rules:

- Prefer real text and hairline structure over effect components. `canvas-text`, `comet-card`, `glare-card` and `text-generate-effect` are no longer used by any route.
- Keep workout data aligned and structured in every mockup.
- Do not imply product capabilities that are not implemented.

## 13. Page composition

All seven routes share the container, type scale, header, footer and CTA. Each keeps a distinct composition:

- **Home**: 7/5 hero split with a ruled glance list; product evidence panel pairing session metrics with the device; four-cell ruled statistics band; 4/8 feature index with numbered rows; shared CTA.
- **Workout Logging**: 6/6 hero with the device and a "Current Session" caption; 2×2 numbered feature grid; CTA.
- **Routines**: split hero across the full width; 5/7 device-and-grid split; CTA.
- **Logbook**: 7/5 hero with sticky device; full-width ruled record table; CTA.
- **Progress**: 6/6 hero; full-width four-column metric band; CTA.
- **Rest Timer**: centred hero; three-column composition with the device flanked by two ruled point lists; CTA.
- **Offline Sync**: 5/7 mirrored hero with the device first on desktop; panel with an offline status bar and a 2×2 grid; CTA.

## 14. Responsive behaviour

- Hero splits stack from `lg`; the device stays centred and never exceeds `300px`.
- Numbered grids go two-up at `sm` and four-up at `lg` where the content supports it.
- Tables collapse to stacked label/value blocks below `sm`.
- The navigation switches to the mobile menu below `lg`.
- Verified at `1440×900`, `768×1024`, `390×844` and `320×720` with no horizontal overflow.
- Tap targets stay at least 44px; the smallest viewport keeps readable body copy and non-wrapping CTAs.

## 15. Explicit avoid-list

Do not use:

- Orange glow, neon gradients or animated gradient buttons.
- Charcoal or near-black page backgrounds.
- Glassmorphism, translucent floating panels or parallax cards.
- Radial glow hero fields or grid-line decorative backgrounds.
- Emoji as interface labels or decoration.
- Em dashes in user-facing copy.
- Motion added only to fill space.
- Generic AI-generated SaaS dashboard styling or dense dashboards on the public site.
- New accent colours without justification.

## 16. Relationship between web and mobile design language

Web and mobile share the same identity:

- Deep burgundy backgrounds and warm cream typography.
- Muted wine surfaces, hairline rules and restrained borders.
- Confident modern sans-serif headings with tabular workout data.
- Calm, minimal effects.

Platform conventions still apply:

- Web uses wider editorial composition and responsive grids.
- Mobile uses focused screens, native spacing and touch-friendly controls.
- Navigation adapts per platform while preserving the same information structure.
- Motion respects each platform's accessibility settings.

This document reflects the implemented foundation and these shared rules. It does not document planned routes, unimplemented capabilities or future redesigns.
