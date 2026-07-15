# mdreadr agent resources

Project-local instructions for AI agents. Start with [`AGENTS.md`](../AGENTS.md).

## Skills

Read the skill whose triggers match your task:

| Skill | Path |
|-------|------|
| CLI & dev workflow | [`skills/mdreadr-cli/SKILL.md`](skills/mdreadr-cli/SKILL.md) |
| Domain & Zod | [`skills/mdreadr-domain/SKILL.md`](skills/mdreadr-domain/SKILL.md) |
| Elysia API & Treaty | [`skills/mdreadr-api/SKILL.md`](skills/mdreadr-api/SKILL.md) |
| Webview & Astryx | [`skills/mdreadr-ui/SKILL.md`](skills/mdreadr-ui/SKILL.md) |
| styled-cva / Tailwind | [`skills/mdreadr-styling/SKILL.md`](skills/mdreadr-styling/SKILL.md) |
| Linux run / debug | [`skills/mdreadr-linux/SKILL.md`](skills/mdreadr-linux/SKILL.md) |
| QA / milestone check | [`skills/mdreadr-check/SKILL.md`](skills/mdreadr-check/SKILL.md) |

## References

| Doc | Purpose |
|-----|---------|
| [`references/ARCHITECTURE.md`](references/ARCHITECTURE.md) | Process boundaries and data flow |
| [`references/RAILWAY.md`](references/RAILWAY.md) | Onrails patterns used in this repo |
| [`references/LINUX-TROUBLESHOOTING.md`](references/LINUX-TROUBLESHOOTING.md) | Fedora/Electrobun error runbook |
| [`LEARNINGS.md`](LEARNINGS.md) | Session index → skills (backtrack) |
| [`../CONTEXT.md`](../CONTEXT.md) | Domain glossary |

## Milestone gate

After any substantive change:

```bash
bun run check
```

Do not claim work is complete until this passes.
