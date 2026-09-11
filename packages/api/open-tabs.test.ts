import { expect, test } from "bun:test";
import { keepExistingTabs } from "./open-tabs.ts";

const exists = (paths: string[]) => (path: string) => paths.includes(path);

test("keepExistingTabs keeps the tabs whose documents are still on disk", () => {
  const tabs = { paths: ["/a.md", "/gone.md", "/b.md"], activePath: "/b.md" };

  expect(keepExistingTabs(tabs, exists(["/a.md", "/b.md"]))).toEqual({
    paths: ["/a.md", "/b.md"],
    activePath: "/b.md",
  });
});

test("keepExistingTabs drops an active path that no longer exists", () => {
  const tabs = { paths: ["/a.md", "/gone.md"], activePath: "/gone.md" };

  expect(keepExistingTabs(tabs, exists(["/a.md"]))).toEqual({
    paths: ["/a.md"],
    activePath: null,
  });
});

test("keepExistingTabs restores nothing when every document is gone", () => {
  const tabs = { paths: ["/gone.md"], activePath: "/gone.md" };

  expect(keepExistingTabs(tabs, exists([]))).toEqual({ paths: [], activePath: null });
});
