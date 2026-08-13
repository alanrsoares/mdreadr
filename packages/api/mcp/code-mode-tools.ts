import type { McpServer } from "@modelcontextprotocol/server";
import { isErr } from "@onrails/result";
import { newQuickJSWASMModule, shouldInterruptAfterDeadline } from "quickjs-emscripten";
import { z } from "zod";
import type { Author, BlockAnchor } from "../../domain/index.ts";
import {
  addReply,
  buildNotesFilePayload,
  createNote,
  createSuggestion,
  listDocumentBlocks,
  resolveBlockText,
  setNoteStatus,
} from "../../domain/index.ts";
import { documentSession } from "../document-session.ts";
import { isWorkspacePathAllowed, toPathNotAllowedError, writeTextFile } from "../documents.ts";
import { sessionStore } from "../session.ts";
import { defineTool, registerTools, toolJson } from "./shared.ts";

export type GetNotesFilter = {
  status?: string;
  kind?: string;
};

export type GetSuggestionsFilter = {
  status?: string;
};

export type AuthorParam = {
  kind: "agent" | "human" | "system";
  name?: string;
};

export type AddNoteParams = {
  anchor: BlockAnchor;
  body: string;
  author: AuthorParam;
  kind?: "comment" | "request";
};

export type AddReplyParams = {
  body: string;
  author: AuthorParam;
};

export type ProposeEditParams = {
  anchor: BlockAnchor;
  replacementText: string;
  noteId?: string;
  author?: AuthorParam;
};

const MEMORY_LIMIT_BYTES = 32 * 1024 * 1024; // 32MB max heap
const MAX_STACK_SIZE_BYTES = 1024 * 1024; // 1MB max stack
const MAX_LOG_LINES = 100;
const MAX_LOG_LINE_CHARS = 1000;

export const createMdreadrSandboxApi = () => ({
  getDocument: () => {
    const snapshot = sessionStore.snapshot();
    return {
      path: snapshot.document?.path ?? null,
      content: snapshot.documentContent ?? null,
      latestSeq: sessionStore.latestSeq(),
    };
  },

  getBlocks: () => {
    const snapshot = sessionStore.snapshot();
    return snapshot.documentContent ? listDocumentBlocks(snapshot.documentContent) : [];
  },

  getBlock: (anchor: BlockAnchor) => {
    const snapshot = sessionStore.snapshot();
    return snapshot.documentContent
      ? (resolveBlockText(snapshot.documentContent, anchor) ?? null)
      : null;
  },

  getNotes: (filter?: GetNotesFilter) => {
    let notes = sessionStore.getNotes();
    if (filter?.status) {
      notes = notes.filter((n) => n.status === filter.status);
    }
    if (filter?.kind) {
      notes = notes.filter((n) => n.kind === filter.kind);
    }
    return notes;
  },

  getNote: (id: string) => sessionStore.getNotes().find((n) => n.id === id) ?? null,

  addNote: (params: AddNoteParams) => {
    const note = createNote(
      {
        anchor: params.anchor,
        body: params.body,
        author: params.author as Author,
        kind: params.kind,
      },
      sessionStore.snapshot().document ?? undefined,
    );
    sessionStore.addNote(note);
    documentSession.triggerChange();
    return note;
  },

  addReply: (noteId: string, params: AddReplyParams) => {
    const note = sessionStore.getNotes().find((n) => n.id === noteId);
    if (!note) throw new Error(`Note not found: ${noteId}`);
    const updatedNote = addReply(note, { body: params.body, author: params.author as Author });
    sessionStore.noteReplied(updatedNote);
    documentSession.triggerChange();
    return updatedNote;
  },

  setNoteStatus: (noteId: string, status: "open" | "resolved" | "wontfix") => {
    const note = sessionStore.getNotes().find((n) => n.id === noteId);
    if (!note) throw new Error(`Note not found: ${noteId}`);
    const updatedNote = setNoteStatus(note, status);
    sessionStore.noteStatusChanged(updatedNote);
    documentSession.triggerChange();
    return updatedNote;
  },

  proposeEdit: (params: ProposeEditParams) => {
    const suggestion = createSuggestion(
      {
        anchor: params.anchor,
        replacementText: params.replacementText,
        noteId: params.noteId,
        author: (params.author as Author) ?? { kind: "agent" },
      },
      sessionStore.snapshot().document ?? undefined,
    );
    sessionStore.addSuggestion(suggestion);
    documentSession.triggerChange();
    return suggestion;
  },

  getSuggestions: (filter?: GetSuggestionsFilter) => {
    let suggestions = sessionStore.getSuggestions();
    if (filter?.status) {
      suggestions = suggestions.filter((s) => s.status === filter.status);
    }
    return suggestions;
  },

  saveNotes: async (path: string) => {
    const documentPath = sessionStore.snapshot().document?.path ?? null;
    if (!isWorkspacePathAllowed(path, documentPath)) {
      throw new Error(toPathNotAllowedError(path).error);
    }
    const notes = sessionStore.getNotes();
    const document = sessionStore.snapshot().document ?? undefined;
    const content = JSON.stringify(buildNotesFilePayload(document, notes), null, 2);
    const result = await writeTextFile(path, content);
    if (isErr(result)) {
      throw new Error(`Failed to save notes: ${result.error.message}`);
    }
    return true;
  },
});

export type CodeModeResult = {
  success: boolean;
  result?: unknown;
  error?: string;
  logs: string[];
  durationMs: number;
};

let quickJsModulePromise: ReturnType<typeof newQuickJSWASMModule> | undefined;

function getQuickJSModule() {
  if (quickJsModulePromise === undefined) {
    quickJsModulePromise = newQuickJSWASMModule();
    quickJsModulePromise.catch(() => {
      quickJsModulePromise = undefined;
    });
  }
  return quickJsModulePromise;
}

/**
 * Executes a JavaScript snippet in QuickJS WASM sandbox (with memory caps, stack limits,
 * interrupt deadlines, and isolated VM context). Falls back to closure execution if WASM fails.
 */
export async function executeCodeModeScript(
  code: string,
  timeoutMs = 5000,
): Promise<CodeModeResult> {
  const logs: string[] = [];
  const addLog = (line: string) => {
    if (logs.length < MAX_LOG_LINES) {
      const capped =
        line.length > MAX_LOG_LINE_CHARS ? `${line.slice(0, MAX_LOG_LINE_CHARS)}…` : line;
      logs.push(capped);
    }
  };

  const sandboxApi = createMdreadrSandboxApi();
  const startTime = Date.now();

  try {
    const mod = await getQuickJSModule();
    const runtime = mod.newRuntime();
    runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
    runtime.setMaxStackSize(MAX_STACK_SIZE_BYTES);

    const deadline = Date.now() + timeoutMs;
    runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline));

    const context = runtime.newContext();

    // Bind console with log, warn, error methods
    const consoleHandle = context.newObject();
    const createLogHandler = (prefix = "") =>
      context.newFunction("log", (...args) => {
        const line = args
          .map((arg) => {
            try {
              return context.dump(arg);
            } catch {
              return String(arg);
            }
          })
          .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
          .join(" ");
        addLog(prefix ? `${prefix}${line}` : line);
      });

    const logFn = createLogHandler();
    const warnFn = createLogHandler("[WARN] ");
    const errorFn = createLogHandler("[ERROR] ");

    context.setProp(consoleHandle, "log", logFn);
    context.setProp(consoleHandle, "warn", warnFn);
    context.setProp(consoleHandle, "error", errorFn);
    logFn.dispose();
    warnFn.dispose();
    errorFn.dispose();
    context.setProp(context.global, "console", consoleHandle);
    consoleHandle.dispose();

    // Bind synchronous mdreadr host API bridge
    const hostBridgeFn = context.newFunction("hostBridge", (methodHandle, argsJsonHandle) => {
      const method = context.dump(methodHandle) as string;
      const argsJson = context.dump(argsJsonHandle) as string;
      const args = argsJson ? JSON.parse(argsJson) : [];

      try {
        let res: unknown;
        if (method === "getDocument") res = sandboxApi.getDocument();
        else if (method === "getBlocks") res = sandboxApi.getBlocks();
        else if (method === "getBlock") res = sandboxApi.getBlock(args[0]);
        else if (method === "getNotes") res = sandboxApi.getNotes(args[0]);
        else if (method === "getNote") res = sandboxApi.getNote(args[0]);
        else if (method === "addNote") res = sandboxApi.addNote(args[0]);
        else if (method === "addReply") res = sandboxApi.addReply(args[0], args[1]);
        else if (method === "setNoteStatus") res = sandboxApi.setNoteStatus(args[0], args[1]);
        else if (method === "proposeEdit") res = sandboxApi.proposeEdit(args[0]);
        else if (method === "getSuggestions") res = sandboxApi.getSuggestions(args[0]);
        else if (method === "saveNotes") res = sandboxApi.saveNotes(args[0]);
        else throw new Error(`Unknown mdreadr method: ${method}`);

        return context.newString(JSON.stringify({ ok: true, value: res }));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return context.newString(JSON.stringify({ ok: false, error: msg }));
      }
    });

    context.setProp(context.global, "__hostBridge", hostBridgeFn);
    hostBridgeFn.dispose();

    // Inject guest wrapper API `mdreadr` into QuickJS global
    const guestScript = `
      globalThis.mdreadr = {
        _call: (method, ...args) => {
          const raw = globalThis.__hostBridge(method, JSON.stringify(args));
          const res = JSON.parse(raw);
          if (!res.ok) throw new Error(res.error);
          return res.value;
        },
        getDocument: () => mdreadr._call('getDocument'),
        getBlocks: () => mdreadr._call('getBlocks'),
        getBlock: (anchor) => mdreadr._call('getBlock', anchor),
        getNotes: (filter) => mdreadr._call('getNotes', filter),
        getNote: (id) => mdreadr._call('getNote', id),
        addNote: (params) => mdreadr._call('addNote', params),
        addReply: (noteId, params) => mdreadr._call('addReply', noteId, params),
        setNoteStatus: (noteId, status) => mdreadr._call('setNoteStatus', noteId, status),
        proposeEdit: (params) => mdreadr._call('proposeEdit', params),
        getSuggestions: (filter) => mdreadr._call('getSuggestions', filter),
        saveNotes: (path) => mdreadr._call('saveNotes', path),
      };
    `;

    const setupResult = context.evalCode(guestScript);
    if ("error" in setupResult && setupResult.error) {
      setupResult.error.dispose();
      context.dispose();
      runtime.dispose();
      throw new Error("Failed to initialize guest sandbox API");
    }
    if ("value" in setupResult && setupResult.value) {
      setupResult.value.dispose();
    }

    // Evaluate user script directly with evalCode
    const userScript = `(() => {\n${code}\n})()`;
    const evalResult = context.evalCode(userScript);

    let finalResult: unknown = null;
    let finalError: string | undefined;

    if ("error" in evalResult && evalResult.error) {
      const dumped = context.dump(evalResult.error);
      evalResult.error.dispose();
      finalError =
        typeof dumped === "object" && dumped !== null && "message" in dumped
          ? String((dumped as { message?: unknown }).message)
          : String(dumped);
    } else if ("value" in evalResult && evalResult.value) {
      finalResult = context.dump(evalResult.value);
      evalResult.value.dispose();
    }

    context.dispose();
    runtime.dispose();

    return {
      success: !finalError,
      result: finalError ? undefined : (finalResult ?? null),
      error: finalError,
      logs,
      durationMs: Date.now() - startTime,
    };
  } catch (wasmErr: unknown) {
    // Fallback runner if WASM runtime fails to instantiate
    return executeFallbackScript(code, sandboxApi, logs, addLog, timeoutMs, startTime, wasmErr);
  }
}

async function executeFallbackScript(
  code: string,
  sandboxApi: ReturnType<typeof createMdreadrSandboxApi>,
  logs: string[],
  addLog: (line: string) => void,
  timeoutMs: number,
  startTime: number,
  _wasmErr: unknown,
): Promise<CodeModeResult> {
  const customConsole = {
    log: (...args: unknown[]) =>
      addLog(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
    warn: (...args: unknown[]) =>
      addLog(
        `[WARN] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`,
      ),
    error: (...args: unknown[]) =>
      addLog(
        `[ERROR] ${args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}`,
      ),
  };

  try {
    const fn = new Function("mdreadr", "console", `return (async () => {\n${code}\n})();`);

    let timer: Timer;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Code execution timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });

    const executionPromise = fn(sandboxApi, customConsole);
    const result = await Promise.race([executionPromise, timeoutPromise]).finally(() => {
      clearTimeout(timer);
    });

    return {
      success: true,
      result: result ?? null,
      logs,
      durationMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: errorMessage,
      logs,
      durationMs: Date.now() - startTime,
    };
  }
}

const codeModeTools = {
  run_script: defineTool({
    description:
      "Code Mode MCP: Execute a JavaScript snippet to inspect documents, query/modify note threads, propose edits, and update note statuses in a single atomic turn. Globally available `mdreadr` helper provides getDocument(), getBlocks(), getBlock(anchor), getNotes(filter), getNote(id), addNote(params), addReply(noteId, params), setNoteStatus(noteId, status), proposeEdit(params), getSuggestions(filter), saveNotes(path). Example code: `const notes = mdreadr.getNotes({ status: 'open' }); return notes.map(n => n.id);`",
    inputSchema: {
      code: z.string().describe("JavaScript script body to execute in the mdreadr sandbox."),
      timeoutMs: z
        .number()
        .optional()
        .describe("Max execution timeout in milliseconds. Defaults to 5000."),
    },
    handle: async ({ code, timeoutMs }) => {
      const result = await executeCodeModeScript(code, timeoutMs ?? 5000);
      return toolJson(result);
    },
  }),
};

export function registerCodeModeTools(server: McpServer): void {
  registerTools(server, codeModeTools);
}
