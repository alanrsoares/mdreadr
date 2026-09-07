# mdreadr UX Design Specification

Component-level interaction rules for the Reader, derived from top-tier markdown readers
(iA Writer, Bear, Typora, Obsidian Minimal) and the laws in [`../DESIGN.md`](../DESIGN.md).

Every section is tagged **Shipped** (in the app today) or **Planned** (specified, not
built). Do not read a Planned rule as a description of current behaviour.

---

## 1. Document Reader Surface

### 1.1 Typographic measure & scale - Shipped
- The prose container is capped by `MEASURE_EMS` (`src/webview/app/components/MarkdownView.tsx`), so the measure holds constant in characters as the reader font size changes. Target 65-75 characters; see [`../DESIGN.md`](../DESIGN.md) §2 for why the value is em-based and why it is still unverified.
- Heading scale is a >= 1.25 stepped ratio. The authoritative sizes are the `tw` definitions in `src/webview/app/ui/reader.tsx`; they are not duplicated here so they cannot drift. `h5` / `h6` deliberately stop shrinking at body size and take their rank from case, colour, and tracking.

### 1.2 Distraction-free sticky chrome - Shipped
- `ReaderDocumentChrome` (`src/webview/app/ui/layout.tsx`) sticks to the top of the scroll container with a hairline `border-b` and a quiet backdrop blur over an opaque chrome background.
- Path and action controls sit on one horizontal row to keep the vertical footprint minimal.

---

## 2. Block Anchors & Review Ergonomics

### 2.1 Gutter affordances - Partially shipped
- **Shipped**: controls are invisible at rest (`opacity: 0`), fade and scale in on `.group/pin:hover` / `:focus-within` / `:focus-visible`, and are motion-suppressed under `prefers-reduced-motion`.
- **Shipped**: the edit control sits in the left gutter (`left: -2rem` at >= 640px).
- **Planned**: the anchor control and `.reader-block-actions` currently sit at `right: 0`, inside the prose column, overlapping the top-right of the block. They must move out to the gutter so no control ever overlays prose.

### 2.2 Note presence on a block - Planned
- A block carrying Notes must read as marked without reflowing: tinted background wash or inset ring.
- **Current violation**: `.reader-block-has-note` uses `border-inline-start: 2px solid` plus a transitioned `padding-inline-start`, which is both the banned side-stripe and a layout shift on every note add/remove.

### 2.3 Inline block editing - Shipped
- Entered by double-click on a block or by the gutter edit control.
- Swaps the block in place for `InlineBlockEditor`, surrounding document context preserved.
- `Escape` cancels, `Cmd+Enter` / `Ctrl+Enter` saves.

---

## 3. Keyboard & Navigation

### 3.1 Anchor and outline navigation - Shipped
- Selecting a `TocSidebar` entry or a Note's anchor control scroll-centres the target (`scrollIntoView({ behavior: "smooth", block: "center" })`) and plays `.reader-block-highlight`.
- No modal dialogue for anything doable inline or in a non-blocking drawer.

### 3.2 Reader font controls - Shipped
- `FontAdjustmentControl` binds `=` / `+`, `-` / `_`, and `0` for size, and owns the leading slider (1.3 to 2.2, step 0.05, default 1.7).

### 3.3 Block-level keyboard navigation - Planned
- `j` / `k` to move block to block and next/previous heading jumps. No handler exists today.
- Movement must set a visible focus target, not just scroll, so the anchor controls become reachable without a mouse.

---

## 4. Design Verification Checklist

Each item is an assertion. It passes when the answer is yes.

1. **Measure**: at full window width and at every font size step, the prose column is 65-75 characters. Verify by rendering a repeated-character string in the reader and measuring, not by eye.
2. **Rhythm**: heading gaps come from `--reader-heading-major-gap` / `--reader-heading-minor-gap`, and no heading collides with the paragraph above it.
3. **Contrast & tint**: light and dark neutrals are tinted, never pure `#000` / `#fff`, and body text meets WCAG AA against its surface in both themes.
4. **Quiet controls**: block controls are invisible at rest, appear only on hover or focus, and never overlap prose at any width.
5. **No reflow**: adding or removing a Note, or entering inline edit, causes zero layout shift in surrounding prose.
6. **A11y**: every interactive icon has an `aria-label` and a visible `:focus-visible` outline; all reveal-on-hover controls are also reachable by keyboard.
