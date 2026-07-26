import { type BlockAnchor, createSuggestion } from "../../domain/index.ts";
import { documentSession } from "../document-session.ts";
import { sessionStore } from "../session.ts";
import {
  anchorInputSchema,
  authorInputSchema,
  type ToolDefinition,
  type ToolHandler,
  toolJson,
  toSuggestionSummary,
} from "./shared.ts";

export const suggestionTools: ToolDefinition[] = [
  {
    name: "propose_edit",
    description:
      "Propose a replacement for the text at a block anchor. Never writes the document: the human must explicitly accept it in-app, which applies it to their in-progress Draft, and it only reaches disk once they save.",
    inputSchema: {
      type: "object",
      properties: {
        anchor: anchorInputSchema,
        replacementText: {
          type: "string",
          description: "The proposed replacement text for the anchored block.",
        },
        noteId: {
          type: "string",
          description: "The note/request this suggestion answers, if any.",
        },
        author: {
          ...authorInputSchema,
          description: "The author of the suggestion. Defaults to kind: 'agent'.",
        },
      },
      required: ["anchor", "replacementText"],
    },
  },
  {
    name: "get_suggestions",
    description:
      "List edit suggestions (propose_edit results) as compact rows (id, status, anchor, noteId, author). Status is pending → accepted → completed (landed on disk) or rejected. After a suggestion_status_changed event, call this (or get_suggestion) to learn whether the human accepted or rejected your proposal. Pass verbose: true for full suggestions including replacementText.",
    inputSchema: {
      type: "object",
      properties: {
        verbose: {
          type: "boolean",
          description:
            "Return full suggestions including replacementText and anchor. Defaults to false.",
        },
      },
    },
  },
  {
    name: "get_suggestion",
    description: "Get one suggestion by id, including its replacementText, anchor, and status.",
    inputSchema: {
      type: "object",
      properties: {
        suggestionId: {
          type: "string",
        },
      },
      required: ["suggestionId"],
    },
  },
];

type ProposeEditArgs = {
  anchor: BlockAnchor;
  replacementText: string;
  noteId?: string;
  author?: Parameters<typeof createSuggestion>[0]["author"];
};

export const suggestionToolHandlers: Record<string, ToolHandler> = {
  propose_edit: (args) => {
    const params = args as ProposeEditArgs;
    const suggestion = createSuggestion(
      {
        anchor: params.anchor,
        replacementText: params.replacementText,
        noteId: params.noteId,
        author: params.author ?? { kind: "agent" },
      },
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
  get_suggestions: (args) => {
    const params = args as { verbose?: boolean };
    const suggestions = sessionStore.getSuggestions();
    return toolJson({
      suggestions: params.verbose ? suggestions : suggestions.map(toSuggestionSummary),
    });
  },
  get_suggestion: (args) => {
    const params = args as { suggestionId: string };
    const suggestion = sessionStore
      .getSuggestions()
      .find((item) => item.id === params.suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${params.suggestionId}`);
    }
    return toolJson(suggestion);
  },
};
