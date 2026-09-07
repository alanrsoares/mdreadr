# mdreadr Product Context

What mdreadr is and who it is for. Domain vocabulary lives in [`CONTEXT.md`](CONTEXT.md),
design laws in [`DESIGN.md`](DESIGN.md), interaction spec in
[`docs/UX_DESIGN_SPEC.md`](docs/UX_DESIGN_SPEC.md).

## Users & Physical Scene
- **Target users**: Software engineers, technical architects, and engineering managers reviewing markdown RFCs, system designs, PR plans, and agent output.
- **Physical scene**: A focused reviewer at a desktop display, office or home, natural or desk lamp lighting. They read dense technical text for 30 to 60 minutes: scrolling, cross-referencing headings, and leaving actionable feedback on exact paragraphs, headings, or code fences without losing their place.

## Why it exists
Generic markdown previewers give a reader no way to say "this paragraph, right here" back
to a human or an agent. mdreadr treats the Anchor as the primary object: the reading
surface stays quiet and uninterrupted, and every pinnable block carries a precise,
addressable point that a Note can attach to.

## Tone & Aesthetic Direction
- **Archetype**: Editorial typewriter meets precision instrument.
- **Atmosphere**: Calm, quiet, meticulously spaced, high typographic legibility.
- **Differentiation**:
  - Uncompromising typographic rhythm: bounded measure, tuned leading, no reflow on interaction.
  - Contextually quiet chrome: controls appear when needed, never fight the prose.
  - Zero decorative clutter: no glassmorphic cards, no neon gradients, no toolbars floating over text.

## Anti-References
- No SaaS dashboard patterns: nested cards, stat tiles, chrome for its own sake.
- No side-stripe status borders on Notes or callouts.
- No gradient text, no decorative glass.
- No modal as first resort. Inline block editing and in-situ replies instead.
- No em dashes in UI copy. Use commas, colons, semicolons, periods, or parentheses.

The enforceable form of these bans, with exceptions, is [`DESIGN.md`](DESIGN.md) §4.
