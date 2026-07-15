import { describe, expect, test } from "bun:test";
import { app, sessionStore, startServer } from "../../packages/api/index.ts";

describe("mdreadr api", () => {
  test("health and notes roundtrip", async () => {
    const { url } = startServer(0);
    sessionStore.setNotes([]);

    const health = await app.handle(new Request(`${url}/health`));
    expect(health?.status).toBe(200);

    const create = await app.handle(
      new Request(`${url}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anchor: { kind: "document", blockId: "document-root" },
          body: "Review this",
          author: { kind: "human" },
        }),
      }),
    );
    expect(create?.status).toBe(200);

    const notes = await app.handle(new Request(`${url}/notes`));
    const json = await notes?.json();
    expect(json.notes).toHaveLength(1);
  });
});
