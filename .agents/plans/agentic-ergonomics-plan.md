# Implementation plan — Agentic ergonomics + HITL hardening

**Source:** live-tested the MCP note loop end to end (stdio proxy → HTTP MCP server → Notes/Document) in this session. Findings below are from that real usage, not speculation. One finding is a **contract violation already committed against**: this session used `POST /documents/save` directly from an agent context to write content into the open Document. `CONTEXT.md` (`Document` entry) and `.agents/plans/document-editing-plan.md` (scope decision line 3) both state the Document is "rewritten on disk only by explicit save" from the human's in-app Edit mode — **no agent-facing write routes** was an explicit, user-confirmed decision. The route has no caller-scoping, so nothing currently stops an agent (or any local process) from doing what was just done. This plan's centerpiece (WS-2) is closing that hole with a real mechanism instead of reinstating the ban by convention only.

**Design principle:** agents propose, humans dispose. Every new agent-facing capability below produces something a human explicitly accepts/rejects in-app — never a silent mutation. This extends the existing Draft/explicit-save model rather than replacing it.

**Mechanism inspiration:** `~/.claude/skills/impeccable`'s `live` command solves a structurally identical problem — an agent and a running local server coordinating on events a human must review, across process restarts, without busy-polling. Its scripts (`scripts/live-session-store.mjs`, `scripts/live-poll.mjs`, `scripts/live-accept.mjs`, `scripts/live-complete.mjs`) were read directly (not just the prose in `reference/live.md`) and three concrete mechanisms are lifted below rather than reinvented:
1. **Append-only JSONL journal + reducer.** `live-session-store.mjs`: every event appended to a per-session `.jsonl` with a monotonic `seq`; a pure `applyEvent(snapshot, entry)` reducer folds the journal into a `phase`-tagged snapshot, cached in memory and mirrored to a `.snapshot.json` for fast reload. The journal, not the snapshot, is the source of truth — snapshot is always rebuildable from it. → WS-3.
2. **Long-poll, not short-poll.** `live-poll.mjs`: one blocking call per turn (`GET /poll?token=&timeout=`), server holds the request until an event lands or the slice times out, client loops slices under fetch's ~300s header ceiling until its own (much longer, ~600s) deadline. No event = one `{type:"timeout"}` reply, not an empty busy-loop. → WS-3.
3. **Two-phase accept, not a boolean flag.** The event reducer's phases (`accept_requested` → `variants_ready`/`carbonize_required` → `completed`) separate "human clicked accept" from "fully landed" — a `carbonize_required` result stays open/recoverable until a separate `live-complete.mjs --id` finalizes it. → WS-2's Suggestion status model, below, mirrors this instead of a flat `pending/accepted/rejected`.
4. **Token-scoped local endpoint.** `live.mjs` writes a per-launch token into its discovery file; every `/poll` and reply call presents it. → WS-2's guard rail, below, uses the same shape instead of a vaguer "webview origin" check.

Ground rules: same as sibling plans — Bun, `bun:test`, no new deps unless noted, `@onrails/result`, strict TS, Biome, conventional commits with scope, no AI attribution. Gate after every workstream: `bun run check; echo "exit=$?"`.

---

## Progress tracker

Check off per commit landed, not per file touched. Update this section as work happens — it's the resume point after a `/compact` or a new session.

- [x] UI bug fix — `ReaderLayout` fixed-px grid tracks → `minmax(0, …)` + `min-w-0` on all three panes (`src/webview/app/ui/layout.tsx`). Typechecked; not yet visually confirmed in the installed app (would require rebuilding `/Applications/mdreadr.app` mid-session).
- [x] WS-1 — Note taxonomy (`kind: comment|request`). Schema + `createNote` + CONTEXT.md + tests + UI toggle/badge + MCP `add_note` schema. `bun run check` green.
- [ ] WS-4 — MCP schema fidelity (`author` enum) + `get_document_block`
- [ ] WS-2 — Suggestions domain object + routes + MCP `propose_edit` + dual-token guard rail + UI accept/reject
- [ ] WS-3 — Journal (`seq`-numbered events) + `wait_for_activity` / `get_events` MCP tools
- [ ] WS-6 — Proxy reconnect (`mcp.json` watch) + resume (`session.jsonl` + catch-up read)
- [ ] WS-5 — Per-session MCP transport state (remove global `_initialized`/`sessionId` reset hack)
- [ ] WS-7 — Path-scope `save_session_notes`

---

## WS-1 — Note taxonomy: comment vs edit-request

**Problem:** a Note's intent (chat question vs "please change the doc") is inferred from freeform reply text. This session misread `"write a haiku about mdreadr"` as a chat prompt on first pass; it was actually an edit request anchored to Section A.

**Commit:** `feat(domain): add note kind for comment/request`

`packages/domain/schemas/index.ts`
- Add `NoteKindSchema = z.enum(["comment", "request"])`.
- `CreateNoteBodySchema` gains `kind: NoteKindSchema.default("comment")`.
- `Note` type carries `kind`.

`CONTEXT.md`
- Amend **Note** entry: add `kind` (`comment` | `request`) distinguishing a question/observation from a change ask on the anchored block.

`packages/domain/index.ts` (`createNote`) — thread `kind` through.

Tests: `packages/domain/domain.test.ts` — schema defaults to `"comment"` when omitted; accepts explicit `"request"`; rejects other strings.

UI (`NotesPanel.tsx`): composer gets a kind toggle (reuse existing `Selector`/segmented-control pattern already used in `NoteCardHeader`, per Explore-agent findings) defaulting to Comment. `NoteCard` shows a small label/icon when `kind === "request"`.

MCP (`packages/api/mcp.ts`): `add_note` tool's `inputSchema` gains `kind: {type: "string", enum: ["comment", "request"]}` (not required, defaults server-side) — mirrors the zod enum instead of the current bare-object looseness (also fixes WS-4).

---

## WS-2 — Suggestions: the safe agent-write path

**Problem:** no MCP tool edits Document content. The only way to affect content is the human-only `/documents/save` route, which an agent can call directly (as happened this session) with a full-file overwrite and no conflict detection — silent clobber risk if the human is mid-edit.

**Commit:** `feat(domain): add Suggestion — agent-proposed anchored patch`

New domain concept, **Suggestion**: an agent-authored proposed replacement for the text at a block Anchor, sitting alongside Notes, never auto-applied.

`packages/domain/schemas/index.ts`
```ts
// Mirrors impeccable's accept_requested → variants_ready/carbonize_required → completed split:
// "accepted" only means the human clicked Accept and it landed in the Draft — it is NOT on
// disk yet. "completed" is reserved for after the human's own explicit save. This makes the
// status honestly answer "did this reach disk" instead of conflating UI-accept with persisted.
export const SuggestionStatusSchema = z.enum(["pending", "accepted", "completed", "rejected"]);
export const CreateSuggestionBodySchema = z.object({
  anchor: BlockAnchorSchema,
  replacementText: z.string().min(1),
  noteId: z.string().optional(), // links back to the Note/request that prompted it
  author: AuthorSchema,
});
```
`Suggestion` type: `{ id, anchor, replacementText, noteId?, author, status, createdAt, updatedAt }`.

Transition `accepted → completed` fires from the existing save path (WS-2's Draft-apply hooks into `document-editing-plan.md`'s `saveDraft`): when the Document is saved and the saved content still contains the suggestion's `replacementText` at its anchor, flip any `accepted` Suggestions for that Document to `completed`. An MCP client asking "did my suggestion actually land" gets a real answer instead of "the button was clicked."

`CONTEXT.md` — new term:
```markdown
**Suggestion**:
An agent-proposed replacement for the text at an Anchor, shown inline pending human Accept/Reject. Accepting applies it through the normal Draft/save path; it is never written to disk on its own.
_Avoid_: patch, diff, auto-edit
```

`packages/api/session.ts` (`sessionStore`) — add `suggestions` collection alongside `notes`: `addSuggestion`, `getSuggestions`, `setSuggestionStatus`.

`packages/api/index.ts` — routes mirroring the Notes ones:
- `GET /suggestions`
- `POST /suggestions`
- `PATCH /suggestions/:id/status` — `"accepted"` applies `replacementText` at `anchor` into the **Draft** (not disk) via the same seam `document-editing-plan.md` built (`documentSession`/Draft), so the human still does the explicit save. `"rejected"` just marks status.

`packages/api/mcp.ts` — new MCP tool `propose_edit(anchor, replacementText, noteId?)`. This is the tool an agent calls instead of ever touching `/documents/save`.

**Guard rail (do this in the same commit, not later):** two per-launch tokens, same shape as `live.mjs`'s discovery-file token, both minted in `startServer` alongside the existing `mcp.json` write (`packages/api/index.ts:366-377`):
- **Agent token** — written into `~/.config/mdreadr/mcp.json` next to `url`. MCP tool routes (`/mcp`, `/mcp/message`) and the new `/suggestions*` routes require it.
- **Webview token** — never written to disk; passed to the webview at launch (Electrobun can inject it into the page the same way it already resolves the API port; check how `src/webview/app/session/reader-api.ts`'s Treaty client learns the port today and thread the token the same way). Required by `/documents/save` and `/notes/load` (anything that writes to disk or reads arbitrary paths).

Neither token is optional-if-present — a request to a token-gated route with a missing/wrong token is a 401, full stop. This is what actually closes the hole from this session (raw `POST /documents/save` from an agent context): the route stops trusting "request came from loopback" and starts trusting "request came from the webview specifically." Removing the MCP path alone wouldn't have — `/documents/save` was never MCP-gated in the first place, `curl` reached it directly.

UI: `NotesPanel.tsx` or a sibling `SuggestionsPanel` shows pending Suggestions inline near their Anchor (reuse the `data-[pending=true]` shadow affordance already in `ReaderNotesAside`, per the layout fix just applied) with Accept/Reject buttons. Accept flows into the existing Draft state from `document-editing-plan.md` WS-3 (`editDraft`), so Cmd+S / Save button behavior is unchanged — human still explicitly saves.

Tests: schema validation; `sessionStore` suggestion CRUD; API route status transitions + 403 on accept-with-no-document-open; Draft-application unit test (`document-draft.ts`) for "apply suggestion" producing correct spliced text at an Anchor's block range.

---

## WS-3 — Journal-backed events + a long-poll MCP tool instead of manual polling

**Problem:** no event when a Note/Reply/Suggestion is added — this session polled `get_session_notes` on a timer driven by the human saying "done" in chat, which doesn't scale, and loses history across an app restart since `sessionStore` is pure in-memory.

**Why long-poll over server push:** MCP server-initiated notifications need a client that's actually subscribed and a transport that reliably carries unsolicited messages end to end — through `WebStandardStreamableHTTPServerTransport` *and* back out through `mcp-stdio-proxy.ts`'s forwarding, untested territory. A long-poll **tool call** needs nothing new from the transport: it's an ordinary request that the server simply holds open until something happens, exactly like `live-poll.mjs`'s `GET /poll`. It works identically whether the agent is this session's raw JSON-RPC-over-bash, a real MCP client, or the stdio proxy relaying it — no special-casing.

**Commit:** `feat(api): journal-backed session events + wait_for_activity`

`packages/api/session.ts` — replace the bare `notes`/`suggestions` arrays with an append-only in-memory journal: `{ seq: number, ts: string, type: "note_added"|"note_replied"|"note_status_changed"|"suggestion_added"|"suggestion_status_changed", entityId: string }[]`. Every `sessionStore` mutation appends one entry (mirrors `live-session-store.mjs`'s `appendEvent`, minus the on-disk `.jsonl` — see WS-6 for why this one *does* need disk backing). Keep an in-memory `Map` of waiters (resolvers) keyed off "waiting for seq > N"; `appendEvent` resolves any waiter whose threshold is now satisfied.

`packages/api/mcp.ts` — new tool `wait_for_activity(sinceSeq, timeoutMs = 25000)`:
- If any journal entry already has `seq > sinceSeq`, return those entries immediately.
- Otherwise register a waiter, race it against `timeoutMs` (cap below the ~30s an MCP tool-call round trip should reasonably hold open — this is a single tool call, not `live-poll.mjs`'s 600s CLI loop; an MCP client's own request timeout is the real ceiling, so start conservative), resolve with `{ events: [] }` on timeout.
- Agent-side loop: call with `sinceSeq = <last seq seen>` in a `while (true)`, immediately re-calling on both a real result and a timeout — same shape as `live-poll.mjs`'s outer loop, just with the slice-under-ceiling logic inverted (server enforces the short ceiling; client is the one who loops indefinitely).

`get_session_notes` gains a sibling `get_events(sinceSeq)` for a non-blocking catch-up read (what `wait_for_activity` uses internally, exposed directly for the resume path in WS-6).

Tests: `packages/api/mcp.test.ts` (new) — `wait_for_activity` with no activity returns after `timeoutMs` with empty events; adding a note while a `wait_for_activity` call is pending resolves it immediately with that event, not on the next timeout tick; two concurrent waiters both resolve.

---

## WS-4 — MCP schema fidelity + block-scoped read

**Problem:** `add_reply`/`add_note` tool `inputSchema.author` is `{type: "object"}` with no enum — the actual constraint (`kind: "human"|"agent"|"system"`, `AuthorSchema` in `packages/domain/schemas/index.ts:10`) is invisible from the MCP surface; this session only found it by reading source. Separately, `get_current_document` returns the whole file as one string — an agent proposing a Suggestion (WS-2) has to re-locate the anchor's text itself by string search, which is fragile if the anchor label isn't unique.

**Commit:** `feat(api): typed MCP schemas + block-scoped document read`

`packages/api/mcp.ts`
- Fix every `author` field in tool `inputSchema`s to the real shape: `{type: "object", properties: {kind: {type: "string", enum: ["human","agent","system"]}}, required: ["kind"]}`.
- New tool `get_document_block(anchor)` — returns the current text for one block, using the same Anchor Plan machinery `anchorDisplayLabel`/anchor matching already uses on the frontend (check `src/webview/app/markdown/anchors.ts` for the block-id-to-range logic and whether it's reachable from `packages/api` or needs a shared extraction into `packages/domain`).

Tests: MCP tool schema snapshot test (inputSchema shapes match zod-derived shapes — consider generating the JSON Schema from the zod schemas with `zod-to-json-schema` if already a transitive dep, instead of hand-maintaining two copies that can drift again).

---

## WS-5 — Per-session MCP state (remove the global reset hack)

**Problem:** `packages/api/index.ts`'s `/mcp` and `/mcp/message` routes currently reset the transport's private `_initialized`/`sessionId` fields via an `unknown` cast whenever a POST body contains `method: "initialize"` (uncommitted diff seen at session start). This is a global singleton transport — two concurrent MCP clients (e.g. this agent + Claude Desktop both talking to the same running app) each sending `initialize` will stomp on each other's session state.

**Commit:** `fix(api): per-session MCP transport instead of global reset`

Investigate whether `@modelcontextprotocol/sdk`'s `WebStandardStreamableHTTPServerTransport` supports a session-keyed map natively (check SDK version in `bun.lock` / node_modules types first — this may already be solved upstream and the reset hack may be working around a different bug; read the SDK's session handling before redesigning). If not natively supported, key a `Map<sessionId, TransportState>` in `packages/api/mcp.ts` and drop the private-field reset in `index.ts` entirely.

Tests: two concurrent `initialize` calls (simulate via two fetch requests without awaiting the first) each get independent, non-clobbered sessions.

---

## WS-6 — Proxy resilience across app restarts (resume, not just reconnect)

**Problem, two layers:**
1. `mcp-stdio-proxy.ts` reads `~/.config/mdreadr/mcp.json` once at startup (`mcp-stdio-proxy.ts:8-18`). If the app restarts mid-session (crash, update, manual relaunch), the port changes and the proxy never re-reads — dead connection until the user restarts the proxy's parent (Claude Desktop) too.
2. Even with reconnect fixed, WS-3's journal is in-memory only (`packages/api/session.ts`, same as `sessionStore` today) — an app restart wipes it. An agent that reconnects has no way to tell "what did I miss while disconnected," same gap `live-session-store.mjs` closes for its own journal by keeping it on disk, independent of any single process's lifetime.

**Commit:** `fix(mcp-stdio-proxy): reconnect + resume via persisted journal`

- **Reconnect:** watch `mcp.json` for changes (Bun's `fs.watch`, no new dep); on change, tear down the current `httpTransport` and reconnect to the new URL. On send failure (already caught at `mcp-stdio-proxy.ts:39`), re-read `mcp.json` once before returning the JSON-RPC error, in case the file updated but the watcher event raced.
- **Resume:** persist WS-3's journal to `~/.config/mdreadr/session.jsonl`, append-only, same `{seq, ts, type, entityId}` shape — this is the one piece of session state that outlives the app process, deliberately mirroring why `live-session-store.mjs` is a `.jsonl` file and not just an in-memory `Map`. The proxy tracks the last `seq` it forwarded and, on reconnect, calls `get_events(sinceSeq)` (WS-3) once before resuming `wait_for_activity` — so a Note added while the app was restarting isn't silently dropped.
- Journal rotation/size: cap or truncate on a fresh Document open (a new session doesn't need the previous Document's event history) — decide the exact boundary during implementation, not a concern this plan needs to pre-solve.

Tests: this file has no test harness today — add a minimal one (spawn the proxy against a fake HTTP MCP server on a known port, kill it, start a new fake server on a different port with a journal containing events past the proxy's last-seen `seq`, rewrite `mcp.json`, assert the next stdio message round-trips against the new port AND that the missed events surface via `get_events`). If that's too heavy for the payoff, at minimum a manual QA step in the final gate.

---

## WS-7 — Path safety on `save_session_notes`

**Problem:** the MCP tool `save_session_notes(path)` (`packages/api/mcp.ts`, `writeTextFile`) accepts any filesystem path with no scoping — an agent (or a compromised/confused client) can write a JSON file anywhere the app process can reach.

**Commit:** `fix(api): scope save_session_notes to safe directories`

- Reject paths outside the current Document's directory and common user directories (Documents, Desktop, home) — mirror whatever scoping `documentSession.isAssetAllowed` already does for asset reads (`packages/api/index.ts:118`) as the pattern to follow.
- Return a typed error (`{code: "PathNotAllowed"}`) rather than silently writing.

Tests: attempt to save outside the allowed roots → rejected; inside Document's directory → succeeds.

---

## Sequencing

WS-1 and WS-4 are independent and small — do first. WS-2 is the centerpiece and depends on nothing else but should land before WS-3 (the journal's `suggestion_added`/`suggestion_status_changed` event types need Suggestions to exist first). WS-6 depends on WS-3 (it persists WS-3's journal and calls its `get_events`) — do them back to back, same session if possible, since WS-6's tests exercise WS-3's tool directly. WS-5 and WS-7 are independent hardening, parallelizable with everything once WS-2 is in.

## Final gate (every workstream)

1. `bun run check; echo "exit=$?"` — must print `exit=0`.
2. For WS-2/WS-3: manual round-trip exactly like this session's test — open a doc, add a `request`-kind Note, call `propose_edit` over the stdio proxy, accept it in-app, confirm Draft (not disk) changed, Cmd+S, confirm disk changed.
3. Do NOT push or open a PR — commits only, one per workstream, report commit hash + deviations.
