# mdreadr Design System & Tokens

Design laws for the Reader surface. Product intent lives in [`PRODUCT.md`](PRODUCT.md),
domain vocabulary in [`CONTEXT.md`](CONTEXT.md), component-level interaction rules in
[`docs/UX_DESIGN_SPEC.md`](docs/UX_DESIGN_SPEC.md).

Token values live in `src/webview/app/theme/mdreadr.css`; reader-scoped tokens in
`src/webview/app/index.css` (`.reader-prose`). This file states the laws, not a second
copy of the values.

## 1. Physical Scene & Palette Strategy
- **Physical Scene**: Technical reviewer reading architectural documents under ambient room lighting, prioritizing clarity over visual stimulation.
- **Palette Strategy**: Restrained neutrals, no pure `#000` / `#fff`.
  - Light mode: subtle warm/paper tone neutrals.
  - Dark mode: deep slate/charcoal tones.
- **Single accent: cobalt.** `--color-accent: light-dark(#1c7ea8, #5ebae7)`, text-on-surface variant `--color-text-accent`. Used strictly for active Anchors, focal states, and unread Note indicators, at <= 10% surface coverage. There is no second accent; the green `--color-background-green` wash is reserved for the "changed on disk" signal and is a state colour, not an accent.

## 2. Typography & Rhythm Invariants
- **Measure (line length)**: enforced by `MEASURE_EMS = 40` in `src/webview/app/components/MarkdownView.tsx`, passed to the Markdown container as `contentWidth = readerFontSize * MEASURE_EMS`. Em-based on purpose: the measure then holds constant in characters across every font size step. Do not add a second `ch`- or `px`-based cap on the prose column; two caps fight and line length swings across the size range (see the comment in `src/webview/app/ui/reader.tsx`).
  - Target: 65-75 characters per line. **Unverified against the shipped prose fonts** at time of writing; 40em is the current best estimate. Measure it (see `docs/UX_DESIGN_SPEC.md` §4) and tune `MEASURE_EMS` to the measurement.
  - The outer sheet padding (`DocumentView.tsx`) is chrome width, not measure. It does not set line length.
- **Prose font pairing**:
  - Headings: clean structured sans-serif, >= 1.25 hierarchy scale step.
  - Body: proportional reading serif or optical variable sans, user-selectable via `--reader-prose-family`.
  - Code: crisp tabular monospace, sized at `0.9x` the reader size.
- **Leading**: `--reader-line-height`, default **1.7**, user-adjustable 1.3 to 2.2 in 0.05 steps (`src/webview/app/theme/font-settings-container.ts`). 1.7 is the tuned default for technical markdown; treat the extremes as accessibility range, not design intent.
- **Vertical spacing rhythm** (tokens on `.reader-prose`):
  - `--reader-heading-major-gap` (`h1`-`h3`): `0.75rem`.
  - `--reader-heading-minor-gap` (`h4`-`h6`): `0.25rem`.
  - Paragraphs and lists: `--reader-block-gap` (`0.75rem`), applied as `row-gap` on `.reader-flow`, never as per-element margins.

## 3. Anchor & Interaction Laws
- **Gutter affordances**:
  - Block controls live in the margin gutter, outside the prose column. Never over prose text.
  - Both controls belong to the same gutter system: today the edit control sits at `left: -2rem` and the anchor control at `right: 0` (inside the column). That asymmetry is a known violation, tracked as polish work.
  - Reveal on block hover or `:focus-within` via `opacity` + `transform`, honouring `prefers-reduced-motion`.
- **Note indication**:
  - Blocks carrying Notes get a tinted background wash or inset marker. **No layout shift**: never animate or add `padding` / `border` that reflows prose. The current `border-inline-start` + `padding-inline-start` transition on `.reader-block-has-note` violates both this law and §4, tracked as polish work.
  - Activating an Anchor smooth-scrolls the target block to viewport centre and plays a brief attention flash, no jump.
- **Inline editing**:
  - Inline block editing replaces the rendered block in place, no modal.
  - `Escape` cancels, `Cmd+Enter` / `Ctrl+Enter` saves. First-class, not discoverability-optional.

## 4. Hard Bans
- No side-stripe borders (`border-left: Npx solid ...`) as a status or emphasis device on Notes, alerts, or cards. Exception: `blockquote`, where the left rule is standard typographic convention, not status decoration.
- No gradient text (`background-clip: text`).
- No decorative glassmorphism or backdrops that reduce contrast. The chrome's `backdrop-blur-sm` over an opaque `--reader-chrome-bg` is legibility, not decoration, and is allowed.
- No modals where inline editing or a collapsible drawer works.
- No em dashes in UI copy or in these docs.

## 5. Vocabulary in UI copy
User-visible copy uses the [`CONTEXT.md`](CONTEXT.md) terms. In particular the concept is
**Anchor**, not "pin". Existing code identifiers (`PinButton`, `pin-components.tsx`,
`onPinBlock`, `.reader-pin-button`) predate that rule and are exempt until a dedicated
rename; new copy and new identifiers are not.
