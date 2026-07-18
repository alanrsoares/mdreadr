# mdreadr

A desktop Reader for markdown Documents with anchored feedback Notes for human–agent review loops.

## Language

**Document**:
A source markdown file on disk, rendered read-only in Preview/Source and rewritten on disk only by explicit save in Edit mode.
_Avoid_: File, page, article

**Draft**:
In-memory edited content of the open Document before the user explicitly saves it back to disk. Discarded on switch unless confirmed.
_Avoid_: buffer, unsaved changes, dirty state

**Note**:
An anchored feedback Thread on a Document, with a `kind` (`comment` | `request`) distinguishing a question/observation from a change ask on the anchored block, a lifecycle status, and one or more Replies.
_Avoid_: Comment, annotation, thread (when meaning Note)

**Reply**:
A single message inside a Note, attributed to a human, agent, or system.
_Avoid_: Message, comment

**Anchor**:
The place on a Document that a Note refers to — either the whole Document or a specific block such as a heading or code fence.
_Avoid_: Pin, reference, location

**Anchor Plan**:
The per-render sequence that assigns each pinnable block (heading, paragraph, code) its Anchor id, in document order, for one Document's prepared markdown.
_Avoid_: Allocator, id map

**Session Notes**:
The in-memory Note collection for the current app session before the user explicitly saves them.
_Avoid_: Draft notes, cache

**Notes file**:
A versioned JSON file the user explicitly saves or opens to persist Session Notes outside the app session.
_Avoid_: Sidecar, notes sidecar

**Suggestion**:
An agent-proposed replacement for the text at an Anchor, shown inline pending human Accept/Reject. Accepting applies it through the normal Draft/save path; it is never written to disk on its own.
_Avoid_: patch, diff, auto-edit
