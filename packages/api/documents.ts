import { ResultAsync } from "@onrails/result";
import type { DocumentRef } from "../domain/index.ts";
import { touchRecent } from "./recents.ts";

export type DocumentError =
  | { _tag: "DocumentNotFound"; path: string }
  | { _tag: "DocumentReadFailed"; path: string; message: string };

export type OpenDocumentResult = {
  path: string;
  content: string;
};

export const readDocument = (path: string): ResultAsync<OpenDocumentResult, DocumentError> =>
  ResultAsync.fromPromise(
    (async () => {
      const file = Bun.file(path);
      if (!(await file.exists())) {
        throw { _tag: "DocumentNotFound", path } satisfies DocumentError;
      }
      const content = await file.text();
      return { path, content };
    })(),
    (error) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "_tag" in error &&
        (error as DocumentError)._tag === "DocumentNotFound"
      ) {
        return error as DocumentError;
      }
      return {
        _tag: "DocumentReadFailed",
        path,
        message: error instanceof Error ? error.message : String(error),
      } satisfies DocumentError;
    },
  );

export const openDocument = (path: string): ResultAsync<OpenDocumentResult, DocumentError> =>
  readDocument(path).andThen((document) =>
    touchRecent(path)
      .map(() => document)
      .mapErr(
        (error): DocumentError => ({
          _tag: "DocumentReadFailed",
          path,
          message: error.message,
        }),
      ),
  );

export const toDocumentRef = (path: string): DocumentRef => ({ path });

export const toDocumentHttpError = (
  error: DocumentError,
): {
  error: string;
  code: string;
} => matchDocumentError(error);

function matchDocumentError(error: DocumentError): {
  error: string;
  code: string;
} {
  switch (error._tag) {
    case "DocumentNotFound":
      return { error: `Document not found: ${error.path}`, code: error._tag };
    case "DocumentReadFailed":
      return { error: error.message, code: error._tag };
  }
}

export const writeTextFile = (
  path: string,
  content: string,
): ResultAsync<void, { _tag: "WriteFailed"; message: string }> =>
  ResultAsync.fromPromise(
    Bun.write(path, content).then(() => undefined),
    (error) =>
      ({
        _tag: "WriteFailed",
        message: error instanceof Error ? error.message : String(error),
      }) satisfies { _tag: "WriteFailed"; message: string },
  );

export const readJsonFile = (
  path: string,
): ResultAsync<unknown, { _tag: "ReadFailed"; message: string }> =>
  ResultAsync.fromPromise(
    (async () => {
      const file = Bun.file(path);
      if (!(await file.exists())) {
        throw new Error(`File not found: ${path}`);
      }
      return file.json();
    })(),
    (error) => ({
      _tag: "ReadFailed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );

export function toZenityFileFilters(patterns: string[] | undefined): string[] {
  if (!patterns || patterns.length === 0) {
    return ["All files | *"];
  }

  const filters = patterns.map((pattern) => {
    switch (pattern) {
      case "*.md":
        return "Markdown | *.md";
      case "*.json":
        return "JSON | *.json";
      default:
        return `Files | ${pattern}`;
    }
  });

  if (!filters.includes("All files | *")) {
    filters.push("All files | *");
  }

  return filters;
}

async function zenityFileSelection(
  title: string,
  filters: string[],
  options?: { save?: boolean; filename?: string },
): Promise<string | null> {
  const args = ["--file-selection", `--title=${title}`];

  if (options?.save) {
    args.push("--save", `--filename=${options.filename ?? ""}`);
  }

  for (const filter of filters) {
    args.push(`--file-filter=${filter}`);
  }

  const proc = Bun.spawn(["zenity", ...args], { stdout: "pipe", stderr: "ignore" });
  const path = (await new Response(proc.stdout).text()).trim();
  const exitCode = await proc.exited;

  if (exitCode !== 0 || path.length === 0) {
    return null;
  }

  return path;
}

export const pickNativePath = (input: {
  mode: "open" | "save";
  defaultPath?: string;
  filters?: string[];
}): ResultAsync<string | null, { _tag: "DialogFailed"; message: string }> =>
  ResultAsync.fromPromise(
    (async () => {
      if (input.mode === "open") {
        return zenityFileSelection("Open file", toZenityFileFilters(input.filters));
      }

      const filename = input.defaultPath ?? "notes.json";
      return zenityFileSelection("Save file", toZenityFileFilters(input.filters ?? ["*.json"]), {
        save: true,
        filename,
      });
    })(),
    (error) => ({
      _tag: "DialogFailed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
