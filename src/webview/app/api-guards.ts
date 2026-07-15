export const hasApiError = (value: unknown): value is { error: string; code?: string } =>
  typeof value === "object" &&
  value !== null &&
  "error" in value &&
  typeof (value as { error: unknown }).error === "string";

export const readPaths = (value: unknown): string[] =>
  typeof value === "object" &&
  value !== null &&
  "paths" in value &&
  Array.isArray((value as { paths: unknown }).paths)
    ? (value as { paths: string[] }).paths
    : [];

export const readOptionalPath = (value: unknown): string | null =>
  typeof value === "object" &&
  value !== null &&
  "path" in value &&
  ((value as { path: unknown }).path === null ||
    typeof (value as { path: unknown }).path === "string")
    ? (value as { path: string | null }).path
    : null;
