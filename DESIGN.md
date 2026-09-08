# mdreadr Design System & Tokens

Design laws for the Reader surface. Product intent lives in [`PRODUCT.md`](PRODUCT.md),
domain vocabulary in [`CONTEXT.md`](CONTEXT.md), component-level interaction rules in
[`docs/UX_DESIGN_SPEC.md`](docs/UX_DESIGN_SPEC.md).

Token values live in `src/webview/app/theme/mdreadr.css`; reader-scoped tokens in
`src/webview/app/index.css` (`.reader-prose`). This file states the laws, not a second
copy of the values.

## 1. Physical Scene & Palette Strategy
- **Physical Scene**: Technical reviewer reading architectural documents under ambient room lighting, prioritizing clarity over visual stimulation.
- **Palette Strategy**: Restrained neutrals, no pure `#000` / `#fff`. Astryx neutral ships pure white dark-mode body text, so `mdreadrTheme.ts` overrides `--color-text-primary` to `light-dark(#111111, #f2ede6)` - 17.8:1 light, 14.9:1 dark against the paper.
  - Light mode: subtle warm/paper tone neutrals.
  - Dark mode: deep slate/charcoal tones.
- **Single accent: cobalt.** `--color-accent: light-dark(#1c7ea8, #5ebae7)`, text-on-surface variant `--color-text-accent`. Used strictly for active Anchors, focal states, and unread Note indicators, at <= 10% surface coverage. There is no second accent; the green `--color-background-green` wash is reserved for the "changed on disk" signal and is a state colour, not an accent.

## 2. Typography & Rhythm Invariants
- **Measure (line length)**: owned by `getReaderMeasurePx` in `src/webview/app/theme/measure.ts`, published as `--reader-measure` on the reader sheet and capped per prose block. Em-based on purpose: the measure then holds constant in characters across every font size step. That var is the only cap on the column; do not add a second `ch`- or `px`-based one (see the comment in `src/webview/app/ui/reader.tsx`).
  - Target: 65-75 characters per line. **Verified** in headless Chrome at 12 / 17 / 22 / 28 / 34px with 1.7 leading: 66-72 characters per line for every family. The per-family ems are serif 33, sans 33, mono 44 - mono needs the wider column because its average glyph is ~0.62em against ~0.47em for the other two.
  - Astryx's `Markdown contentWidth` prop alone does not enforce it: the prop is dropped for any block rendered by a custom component, which is most of the reader. It is still passed, for the blocks Astryx renders itself, from the same number.
  - The outer sheet padding (`DocumentView.tsx`) is chrome width, not measure, but the sheet grows to fit the measure so that past ~24px reader text the sheet cap is not what sets line length. When the window itself is narrower than the measure, lines shorten - that is the one case where the measure cannot hold.
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
  - Both controls sit in the **left** gutter, stacked as one column at `calc(-1 * var(--reader-gutter))` (`1.75rem`, `2rem` from the `sm` breakpoint up): edit above, anchor below. Sheet padding is what reserves the room, so its narrow-width value cannot drop below the gutter. The anchor control used to sit at the end of the measure, inside the block box, where a table or a wide code fence running past the measure came out underneath it.
  - Reveal on block hover or `:focus-within` via `opacity` + `transform`, honouring `prefers-reduced-motion`.
- **Note indication**:
  - Blocks carrying Notes get a tinted background wash plus an inset marker. **No layout shift**: never animate or add `padding` / `border` that reflows prose. `.reader-block-has-note` uses an accent wash, an `inset` box shadow for the rule, and a negative inline margin that cancels its own padding, so toggling a Note moves nothing.
  - Activating an Anchor smooth-scrolls the target block to viewport centre and plays a brief attention flash, no jump.
- **Block cursor**: `j` / `k` move the cursor block to block, `J` / `K` to the next or previous heading (`src/webview/app/hooks/useReaderBlockNavigation.ts`). Movement sets real focus, not just scroll, which is what makes the hover-only gutter controls reachable from the keyboard.
- **Preview <-> Edit is one surface**: both modes share `ReaderColumn` - same centring, same padding, same measure law - and the editor is transparent, borderless and gutterless so `--reader-paper-bg` shows through. Toggling changes the typeface, not the layout: the first glyph keeps its x. The body must not be keyed on the view mode either, or the enter animation replays as a flash.
  - Reading position carries across the toggle (`src/webview/app/hooks/useViewModeHandoff.ts`): rendered blocks and their source offsets form a piecewise-linear map, read *before* the mode flips because the outgoing view unmounts.
  - The document chrome is sticky over the whole document, so the sheet must not be height-capped to one viewport (`ReaderSheet` is `min-h-full`, never `h-full`).
- **Inline editing**:
  - Inline block editing replaces the rendered block in place, no modal.
  - **The block does not move.** The editor's inline padding is cancelled by a negative inline margin (the `.reader-block-has-note` device), its ring is an `inset` shadow, the textarea has no padding of its own, and the source is capped at `--reader-measure` for prose and headings. Verified in the build at 1440px: rendered paragraph and its source both at `left: 240, top: 299.31, width: 475`, and the block above it does not move.
  - **All chrome sits below the text, never above it.** What the reader double-clicked has to stay where they pointed, so the toolbar and the actions are underneath. A heading editor also reproduces the `.reader-flow` heading gap from `data-level`, which it reads off the source's own `#` run, or the block jumps up by that gap.
  - `Escape` cancels, `Cmd+Enter` / `Ctrl+Enter` saves, both from the textarea *and* from a focused toolbar button. First-class, not discoverability-optional.
  - **An edit in progress is not discarded silently.** `Escape` on a dirty editor arms, and says so in place of the shortcut hint; a second `Escape` discards. Opening another block's editor while one is dirty is refused, and the open editor pulses instead. An edit that can no longer be located leaves the editor open with the text in it, since at that point it is the only copy.
  - Focus returns to the block when the editor closes, so `j` / `k` and the gutter controls stay reachable. **By position, not by id**: paragraph and heading ids are content-derived, so an edited block comes back with a different one (`focusBlockAtIndex` in `src/webview/app/markdown/anchors.ts`).
  - Shortcut hints come from `shortcutLabel` (`src/webview/app/platform.ts`). The app ships on macOS and Linux, so a hard-coded `⌘` is wrong half the time.

## 3a. Links out of a Document
- Every link in rendered prose is classified before the browser sees it (`resolveReaderLink`): a markdown Document opens in a Tab, a `#fragment` scroll-centres a heading here, `http` / `https` / `mailto` go to the OS, and everything else is left alone. The reader is a webview: a followed link navigates the app off its own bundle and takes the session with it.
- **An external link says so.** A `↗` follows the text, quiet at rest and full-strength on hover or focus, with the space reserved at rest so revealing it cannot reflow the line. Leaving the app is a different act from moving inside the document, and the reader gets to know which one they are about to do.
- Only `http`, `https` and `mailto` reach the OS opener. The allowlist lives in the main process (`packages/api/external.ts`), not in the webview, because that is where the refusal has to hold.

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
