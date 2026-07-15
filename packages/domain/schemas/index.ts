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
});

export const NoteStatusSchema = z.enum(["open", "resolved", "wontfix"]);

export const NoteSchema = z.object({
  id: z.string().min(1),
  anchor: BlockAnchorSchema,
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

export const PickFileBodySchema = z.object({
  mode: z.enum(["open", "save"]),
  defaultPath: z.string().optional(),
  filters: z.array(z.string()).optional(),
});

export type DocumentRef = z.infer<typeof DocumentRefSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type Reply = z.infer<typeof ReplySchema>;
export type BlockAnchor = z.infer<typeof BlockAnchorSchema>;
export type NoteStatus = z.infer<typeof NoteStatusSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type NotesFile = z.infer<typeof NotesFileSchema>;
