import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { AuthorSchema, CreateSuggestionBodySchema, createSuggestion } from "../../domain/index.ts";
import { documentSession } from "../document-session.ts";
import { sessionStore } from "../session.ts";
import { defineTool, getOrThrow, registerTools, toolJson, toSuggestionSummary } from "./shared.ts";

const suggestionTools = {
  propose_edit: defineTool({
    description:
      "Propose a replacement for the text at a block anchor. Never writes the document: the human must explicitly accept it in-app, which applies it to their in-progress Draft, and it only reaches disk once they save.",
    inputSchema: {
      anchor: CreateSuggestionBodySchema.shape.anchor,
      replacementText: CreateSuggestionBodySchema.shape.replacementText.describe(
        "The proposed replacement text for the anchored block.",
      ),
      noteId: CreateSuggestionBodySchema.shape.noteId.describe(
        "The note/request this suggestion answers, if any.",
      ),
      author: AuthorSchema.optional().describe(
        "The author of the suggestion. Defaults to kind: 'agent'.",
      ),
    },
    handle: ({ anchor, replacementText, noteId, author }) => {
      const suggestion = createSuggestion(
        { anchor, replacementText, noteId, author: author ?? { kind: "agent" } },
        sessionStore.snapshot().document ?? undefined,
      );
      sessionStore.addSuggestion(suggestion);
      documentSession.triggerChange();
      return toolJson({
        id: suggestion.id,
        noteId: suggestion.noteId ?? null,
        status: suggestion.status,
        author: suggestion.author,
        createdAt: suggestion.createdAt,
      });
    },
  }),

  get_suggestions: defineTool({
    description:
      "List edit suggestions (propose_edit results) as compact rows (id, status, anchor, noteId, author). Status is pending → accepted → completed (landed on disk) or rejected. After a suggestion_status_changed event, call this (or get_suggestion) to learn whether the human accepted or rejected your proposal. Pass verbose: true for full suggestions including replacementText.",
    inputSchema: {
      verbose: z
        .boolean()
        .optional()
        .describe(
          "Return full suggestions including replacementText and anchor. Defaults to false.",
        ),
    },
    handle: ({ verbose }) => {
      const suggestions = sessionStore.getSuggestions();
      return toolJson({
        suggestions: verbose ? suggestions : suggestions.map(toSuggestionSummary),
      });
    },
  }),

  get_suggestion: defineTool({
    description: "Get one suggestion by id, including its replacementText, anchor, and status.",
    inputSchema: { suggestionId: z.string() },
    handle: ({ suggestionId }) => {
      const suggestion = getOrThrow(sessionStore.getSuggestions(), suggestionId, "Suggestion");
      return toolJson(suggestion);
    },
  }),
};

export function registerSuggestionTools(server: McpServer): void {
  registerTools(server, suggestionTools);
}
