# Session learnings (encoded knowledge)

Distilled from greenfield build + first Linux bring-up. **Do not duplicate** — live guidance is in skills below.

## Product & architecture

- Reader-first desktop app; Notes are session threads, not flat comments
- Electrobun shell + Elysia loopback + Eden Treaty; domain is Zod-first Onrails
- Gleam dropped; Linux-first v1

## Agent documentation

| Artifact | Location |
|----------|----------|
| Root agent contract | [`AGENTS.md`](../AGENTS.md) |
| Skill index | [`.agents/README.md`](README.md) |
| Architecture / Onrails | [`references/`](references/) |

## Tooling decisions

| Area | Decision |
|------|----------|
| Styling | Astryx chrome + `@styled-cva/react` layout; **intrinsic CVA** `tw.div("…", { variants })` not `.cva()` |
| Lint | Biome strict + `@styled-cva/biome-plugin` + `useSortedClasses` |
| Refactors | `@onrails/codemod --tersify` via `bun run tersify` → `lint:fix` |
| Milestone | `bun run check` |

## Linux bring-up (hard-won)

1. **Runtime deps**: `libayatana-appindicator-gtk3` + `zenity` — not optional on Fedora
2. **Wayland/WebKit**: `GDK_BACKEND=x11` fixes `GLXBadWindow` / exit 133; encoded in npm scripts
3. **Dev webview**: needs Vite on `:5173` for `dev:hmr`; dev bundle lacks loose `views/` files
4. **Install**: `artifacts/*-Setup.tar.gz` → `./installer`, not raw `launcher`
5. **Cursor + dnf**: install system packages outside Cursor AppImage terminal

## Skills map (read by task)

| Task | Skill |
|------|-------|
| Run / build / tersify | [mdreadr-cli](skills/mdreadr-cli/SKILL.md) |
| Fedora crashes / install | [mdreadr-linux](skills/mdreadr-linux/SKILL.md) |
| styled-cva / Tailwind | [mdreadr-styling](skills/mdreadr-styling/SKILL.md) |
| Domain / API / UI / QA | other `mdreadr-*` skills |

When debugging Linux launch failures, read **mdreadr-linux** before guessing at code bugs.
