import { describe, expect, it } from "bun:test";
import { resolveReaderLink } from "./document-links.ts";

const DOC = "/Users/me/dev/mdreadr/docs/UX_DESIGN_SPEC.md";

describe("resolveReaderLink", () => {
  it("resolves a sibling document", () => {
    expect(resolveReaderLink("PRODUCT.md", DOC)).toEqual({
      kind: "document",
      path: "/Users/me/dev/mdreadr/docs/PRODUCT.md",
    });
  });

  it("resolves a parent-relative document", () => {
    expect(resolveReaderLink("../DESIGN.md", DOC)).toEqual({
      kind: "document",
      path: "/Users/me/dev/mdreadr/DESIGN.md",
    });
  });

  it("resolves an explicitly-relative document", () => {
    expect(resolveReaderLink("./notes/plan.markdown", DOC)).toEqual({
      kind: "document",
      path: "/Users/me/dev/mdreadr/docs/notes/plan.markdown",
    });
  });

  it("keeps an absolute path as it is", () => {
    expect(resolveReaderLink("/etc/readme.md", DOC)).toEqual({
      kind: "document",
      path: "/etc/readme.md",
    });
  });

  it("carries a fragment alongside the document", () => {
    expect(resolveReaderLink("DESIGN.md#hard-bans", DOC)).toEqual({
      kind: "document",
      path: "/Users/me/dev/mdreadr/docs/DESIGN.md",
      fragment: "hard-bans",
    });
  });

  it("decodes percent-escaped path segments", () => {
    expect(resolveReaderLink("my%20plan.md", DOC)).toEqual({
      kind: "document",
      path: "/Users/me/dev/mdreadr/docs/my plan.md",
    });
  });

  it("drops a query string", () => {
    expect(resolveReaderLink("DESIGN.md?raw=1", DOC)).toEqual({
      kind: "document",
      path: "/Users/me/dev/mdreadr/docs/DESIGN.md",
    });
  });

  it("reads a bare fragment as an in-page target", () => {
    expect(resolveReaderLink("#anchor-interaction-laws", DOC)).toEqual({
      kind: "fragment",
      id: "anchor-interaction-laws",
    });
  });

  it("decodes a fragment", () => {
    expect(resolveReaderLink("#note%20presence", DOC)).toEqual({
      kind: "fragment",
      id: "note presence",
    });
  });

  it.each([
    ["https://example.com/readme.md", "https url"],
    ["http://example.com", "http url"],
    ["mailto:someone@example.com", "mail link"],
  ])("hands %s to the OS (%s)", (href) => {
    expect(resolveReaderLink(href, DOC)).toEqual({ kind: "external", url: href });
  });

  it.each([
    ["image.png", "image"],
    ["src/index.ts", "source file"],
  ])("opens %s in a tab too (%s)", (href) => {
    expect(resolveReaderLink(href, DOC)).toMatchObject({ kind: "document" });
  });

  it.each([
    ["views://mainview/CONTEXT.md", "webview-internal url"],
    ["file:///etc/passwd", "file url"],
    ["../notes", "extensionless target"],
    ["image%.png", "malformed percent escape in a path"],
    ["#%zz", "malformed percent escape in a fragment"],
    ["", "empty href"],
    ["#", "empty fragment"],
  ])("leaves %s alone (%s)", (href) => {
    expect(resolveReaderLink(href, DOC)).toEqual({ kind: "other" });
  });

  it("cannot resolve a relative document without a document path", () => {
    expect(resolveReaderLink("DESIGN.md")).toEqual({ kind: "other" });
  });

  it("still resolves an absolute document without a document path", () => {
    expect(resolveReaderLink("/tmp/x.md")).toEqual({ kind: "document", path: "/tmp/x.md" });
  });
});
