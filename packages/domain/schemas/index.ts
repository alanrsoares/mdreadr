import { z } from "zod";
import { NOTES_SCHEMA_VERSION } from "../../../shared/constants.ts";

export const DocumentRefSchema = z.object({
  path: z.string().min(1),
});

export const AuthorKindSchema = z.enum(["human", "agent", "system"]);

export const AuthorSchema = z.object({
  kind: AuthorKindSchema,
  agentId: z.string().optional(),
});

export const ReplySchema = z.object({
  id: z.string().min(1),
  author: AuthorSchema,
  body: z.string(),
  createdAt: z.iso.datetime(),
});

export const BlockAnchorKindSchema = z.enum(["document", "heading", "paragraph", "code"]);

export const BlockAnchorSchema = z.object({
  kind: BlockAnchorKindSchema,
  blockId: z.string().min(1),
  headingPath: z.array(z.string()).optional(),
  /** Short preview of anchored content for display in the notes panel */
  label: z.string().optional(),
});

export const NoteStatusSchema = z.enum(["open", "resolved", "wontfix"]);

export const NoteKindSchema = z.enum(["comment", "request"]);

export const NoteSchema = z.object({
  id: z.string().min(1),
  anchor: BlockAnchorSchema,
  kind: NoteKindSchema,
  status: NoteStatusSchema,
  replies: z.array(ReplySchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const NotesFileSchema = z.object({
  schemaVersion: z.literal(NOTES_SCHEMA_VERSION),
  document: DocumentRefSchema.optional(),
  notes: z.array(NoteSchema),
});

export const OpenDocumentBodySchema = z.object({
  path: z.string().min(1),
});

export const CreateNoteBodySchema = z.object({
  anchor: BlockAnchorSchema,
  body: z.string().min(1),
  author: AuthorSchema,
  kind: NoteKindSchema.default("comment"),
});

export const AddReplyBodySchema = z.object({
  body: z.string().min(1),
  author: AuthorSchema,
});

export const UpdateNoteStatusBodySchema = z.object({
  status: NoteStatusSchema,
});

export const SaveNotesBodySchema = z.object({
  path: z.string().min(1),
  notes: z.array(NoteSchema),
  document: DocumentRefSchema.optional(),
});

export const LoadNotesBodySchema = z.object({
  path: z.string().min(1),
});

export const SaveDocumentBodySchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export const PickFileBodySchema = z.object({
  mode: z.enum(["open", "save"]),
  defaultPath: z.string().optional(),
  filters: z.array(z.string()).optional(),
});

// Mirrors impeccable's accept_requested -> variants_ready/carbonize_required -> completed
// split: "accepted" only means the human clicked Accept and it landed in the Draft, not on
// disk yet. "completed" is reserved for after the human's own explicit save.
export const SuggestionStatusSchema = z.enum(["pending", "accepted", "completed", "rejected"]);

export const SuggestionSchema = z.object({
  id: z.string().min(1),
  anchor: BlockAnchorSchema,
  replacementText: z.string().min(1),
  noteId: z.string().optional(),
  author: AuthorSchema,
  status: SuggestionStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateSuggestionBodySchema = z.object({
  anchor: BlockAnchorSchema,
  replacementText: z.string().min(1),
  noteId: z.string().optional(),
  author: AuthorSchema,
});

export const UpdateSuggestionStatusBodySchema = z.object({
  status: z.enum(["accepted", "rejected"]),
});

export type DocumentRef = z.infer<typeof DocumentRefSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type Reply = z.infer<typeof ReplySchema>;
export type BlockAnchor = z.infer<typeof BlockAnchorSchema>;
export type NoteStatus = z.infer<typeof NoteStatusSchema>;
export type NoteKind = z.infer<typeof NoteKindSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type NotesFile = z.infer<typeof NotesFileSchema>;
export type SuggestionStatus = z.infer<typeof SuggestionStatusSchema>;
export type Suggestion = z.infer<typeof SuggestionSchema>;

export type CreateNoteInput = z.input<typeof CreateNoteBodySchema>;
export type AddReplyInput = z.infer<typeof AddReplyBodySchema>;
export type SaveNotesInput = z.infer<typeof SaveNotesBodySchema>;
export type SaveDocumentInput = z.infer<typeof SaveDocumentBodySchema>;
export type PickFileInput = z.infer<typeof PickFileBodySchema>;
export type CreateSuggestionInput = z.infer<typeof CreateSuggestionBodySchema>;

/** Client-side note creation request; the server attaches `author`. */
export type CreateNoteRequest = Omit<CreateNoteInput, "author">;
