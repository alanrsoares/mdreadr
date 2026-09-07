# mdreadr UX Design Specification

Component-level interaction rules for the Reader, derived from top-tier markdown readers
(iA Writer, Bear, Typora, Obsidian Minimal) and the laws in [`../DESIGN.md`](../DESIGN.md).

Every section is tagged **Shipped** (in the app today), **Planned** (specified, not
built) or **Cut** (considered and rejected, with the reason). Do not read a Planned rule
as a description of current behaviour.

---

## 1. Document Reader Surface

### 1.1 Typographic measure & scale - Shipped
- Prose blocks are capped by `--reader-measure`, computed by `getReaderMeasurePx` (`src/webview/app/theme/measure.ts`) from the reader font size and prose family, so the measure holds constant in characters as the reader font size changes. Measured at 66-72 characters per line across the size range; see [`../DESIGN.md`](../DESIGN.md) §2 for the numbers and the one case (window narrower than the measure) where it cannot hold.
- Heading scale is a >= 1.25 stepped ratio. The authoritative sizes are the `tw` definitions in `src/webview/app/ui/reader.tsx`; they are not duplicated here so they cannot drift. `h5` / `h6` deliberately stop shrinking at body size and take their rank from case, colour, and tracking.

### 1.2 Distraction-free sticky chrome - Shipped
- `ReaderDocumentChrome` (`src/webview/app/ui/layout.tsx`) sticks to the top of the scroll container with a hairline `border-b` and a quiet backdrop blur over an opaque chrome background.
- It only actually sticks because `ReaderSheet` is `min-h-full` rather than `h-full`: a sheet capped at one viewport gives the sticky header a containing block that ends there, and the chrome scrolls away with the first screenful.
- Path and action controls sit on one horizontal row to keep the vertical footprint minimal.

---

## 2. Block Anchors & Review Ergonomics

### 2.1 Gutter affordances - Shipped
- Controls are invisible at rest (`opacity: 0`), fade and scale in on `.group/pin:hover` / `:focus-within` / `:focus-visible`, and are motion-suppressed under `prefers-reduced-motion`.
- Both controls flank the text column from one token, `--reader-gutter`: edit on the left, anchor just past the end of the measure. Verified at 760 / 1440 / 2200px window widths: neither overlaps prose, both stay inside the sheet.
- `.reader-block-actions` and its `BlockActions` component were dead code (never rendered) and have been deleted rather than moved.

### 2.2 Note presence on a block - Shipped
- A block carrying Notes reads as marked without reflowing: an accent wash plus an `inset` box-shadow rule, with a negative inline margin cancelling its own padding.
- Verified in the browser: toggling the class moves no surrounding block, and the first glyph of the marked block stays at the same x.

### 2.3 Preview <-> Edit toggle - Shipped
- Both modes render inside `ReaderColumn`, so the column, the padding and the centring do not move. Verified: the first glyph of the prose and the first character of the source both sit at x=516 at 1440px.
- The editor is transparent, borderless and has no line-number gutter, so it reads as the same sheet of paper rather than a box dropped onto it. CodeMirror's bundled dark theme paints its own background, which `index.css` has to outrank.
- Reading position is carried across, both ways (`useViewModeHandoff`): rendered blocks paired with their source offsets make a piecewise-linear map between reader pixels and editor offsets.
  - **Known limit**: accuracy tracks landmark density. Blocks the reader anchors (headings, paragraphs, code, lists, tables) are landmarks; inside one long block the map is linear, so a screen-tall list can land the toggle a few lines off. Verified round trip on `DESIGN.md`: back within ~4 lines of where it started.
  - CodeMirror shares the reader's scroll container rather than owning one, so neither `EditorView.scrollIntoView` nor `coordsAtPos` can be used to restore; the height map (`lineBlockAt`) can, and gets a second pass once the target region is really rendered.
- The document body is not keyed on the view mode: keying it remounted the subtree and replayed the enter animation as a flash on every toggle.

### 2.4 Inline block editing - Shipped
- Entered by double-click on a block or by the gutter edit control. A double-click on a link, a code block's own control, or any other embedded control is that control's gesture and does not open the editor (`EditableBlock`, `src/webview/app/ui/editable-block.tsx`, which every anchored block kind goes through).
- Swaps the block in place for `InlineBlockEditor`, surrounding document context preserved.
- **Zero shift on the block itself**: padding cancelled by a negative inline margin, an `inset` ring rather than a border, no padding on the textarea, and the source capped at `--reader-measure` so it wraps where the rendered text wrapped. Measured in the build at 1440px: rendered and source both at `left: 240, top: 299.31, width: 475`, block above unmoved. Everything below moves down by the height of the chrome, which sits *below* the text on purpose.
- `Escape` cancels, `Cmd+Enter` / `Ctrl+Enter` saves, from the textarea and from a focused toolbar button (the handler is on the editor section, not the textarea).
- The formatting toolbar is one Tab stop with roving focus: `ArrowLeft` / `ArrowRight` / `Home` / `End` move within it. Verified: `Bold` -> `ArrowRight` -> `Italic` -> `End` -> `Heading 3`. Its buttons cancel `mousedown`, so a click acts on the selection the reader had.
- Transforms behind the toolbar and the shortcuts are pure and tested (`src/webview/app/markdown/inline-edit-ops.ts`): markers toggle back off, a collapsed caret takes the word it sits in, line prefixes apply to every line the selection touches, and the same heading button toggles the level back to a paragraph.
- **Losing an edit takes two deliberate steps.** A dirty `Escape` arms and the hint says so; a second one discards. Starting another block's edit while one is dirty is refused, and the open editor pulses (`callAttentionToInlineEditor`). A save that cannot locate the block keeps the editor open and shows the reason inline.
- On close, focus goes back to the block by document position, and an applied edit flashes it. Verified: after both Cancel and Apply, `document.activeElement` is the block, and after Apply it carries `.reader-block-edit-flash`. Position, not id, because editing a paragraph or heading changes its content-derived id, which is also why the old id-based flash never fired.

### 2.5 Links inside a Document - Shipped
- The reader is a webview, so a followed link navigates the app off its own bundle and the session is gone (`asar_read_file failed for 'views/mainview/CONTEXT.md'`). Every click is classified first by `resolveReaderLink` (`src/webview/app/markdown/document-links.ts`), matched exhaustively:
  - **Another markdown Document** (relative, parent-relative or absolute, percent-escapes decoded, query dropped): opens in a Tab through the same `onOpenPath` the recents list uses. A `#fragment` on it is carried but not yet applied in the opened Tab.
  - **A bare `#fragment`**: scroll-centres and flashes the heading in the Document already open. Markdown fragments are GitHub-style slugs while reader heading ids carry a `heading-` prefix, so both spellings are tried (`scrollToHeadingSlug`).
  - **`http`, `https`, `mailto`**: handed to the OS by the main process (`POST /system/open-url`, webview-token guarded, scheme-allowlisted). `file:`, `views:` and `javascript:` are refused there, not just here.
  - **Anything else** (other file types, relative paths with no Document to resolve against): left to the browser untouched.
- Handled by delegation on the reader article, not by a `link` component override: list and table segments render without the override, which is exactly where a Document's links to its neighbours tend to sit.
- External links carry a `↗` after the text, at rest and brighter on hover or focus. The glyph's space is reserved always, so revealing it cannot reflow the line. The full destination is filled into a native tooltip on first hover, since the reader has no status bar.

---

## 3. Keyboard & Navigation

### 3.1 Anchor and outline navigation - Shipped
- Selecting a `TocSidebar` entry or a Note's anchor control scroll-centres the target (`scrollIntoView({ behavior: "smooth", block: "center" })`) and plays `.reader-block-highlight`.
- No modal dialogue for anything doable inline or in a non-blocking drawer.

### 3.2 Reader font controls - Shipped
- `FontAdjustmentControl` binds `=` / `+`, `-` / `_`, and `0` for size, and owns the leading slider (1.3 to 2.2, step 0.05, default 1.7).

### 3.3 Block-level keyboard navigation - Shipped
- `j` / `k` move block to block, `J` / `K` jump to the next or previous heading (`src/webview/app/hooks/useReaderBlockNavigation.ts`).
- Movement focuses the block (`tabindex="-1"`, scroll-centred) and paints a `:focus-visible` ring, which through `.group/pin:focus-within` also reveals that block's gutter controls - that is how they become reachable without a mouse.
- The handler is on the document, not the reader root, because the reader holds no focus until a cursor exists. It stands down in Edit mode, and for any event inside a text entry (CodeMirror, the inline editor's textarea, inputs), so `j` stays a letter where it should be.

### 3.4 Dimming inactive blocks - Cut
- An iA-Writer-style `reader-focus-dimmed` was considered and dropped. mdreadr is a review tool: the reader scans for context around the block in hand, so dimming the surroundings works against the task. Nothing in the code references it.

---

## 4. Design Verification Checklist

Each item is an assertion. It passes when the answer is yes.

1. **Measure**: at full window width and at every font size step, the prose column is 65-75 characters. Verify by rendering a repeated-character string in the reader and measuring, not by eye. Last measured 66-72 across serif / sans / mono at 12-34px.
2. **Rhythm**: heading gaps come from `--reader-heading-major-gap` / `--reader-heading-minor-gap`, and no heading collides with the paragraph above it.
3. **Contrast & tint**: light and dark neutrals are tinted, never pure `#000` / `#fff`, and body text meets WCAG AA against its surface in both themes.
4. **Quiet controls**: block controls are invisible at rest, appear only on hover or focus, and never overlap prose at any width.
5. **No reflow**: adding or removing a Note, or entering inline edit, causes zero layout shift in surrounding prose.
6. **A11y**: every interactive icon has an `aria-label` and a visible `:focus-visible` outline; all reveal-on-hover controls are also reachable by keyboard.
