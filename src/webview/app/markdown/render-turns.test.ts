import { describe, expect, test } from "bun:test";
import { takeRenderTurn } from "./render-turns.ts";

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("takeRenderTurn", () => {
  test("hands back what the work returns", async () => {
    expect(await takeRenderTurn(async () => "svg")).toBe("svg");
  });

  test("a turn finishes before the next one starts, however long it takes", async () => {
    const order: string[] = [];
    const turn = (name: string, ms: number) =>
      takeRenderTurn(async () => {
        order.push(`${name} configured`);
        await tick(ms);
        order.push(`${name} rendered`);
      });

    // The slow one goes first: without turns its render would land after the
    // fast one had already reconfigured underneath it.
    await Promise.all([turn("slow", 20), turn("fast", 0)]);

    expect(order).toEqual(["slow configured", "slow rendered", "fast configured", "fast rendered"]);
  });

  test("a turn that throws is still a turn: the queue moves on", async () => {
    const failed = takeRenderTurn(async () => {
      throw new Error("bad diagram");
    });
    const after = takeRenderTurn(async () => "still rendering");

    // The rejection reaches whoever asked for that work, and nobody else.
    expect(failed).rejects.toThrow("bad diagram");
    expect(await after).toBe("still rendering");
  });

  test("a queue that has seen a failure keeps its order", async () => {
    const order: string[] = [];
    const failing = takeRenderTurn(async () => {
      await tick(10);
      order.push("failed");
      throw new Error("nope");
    });
    const following = takeRenderTurn(async () => {
      order.push("followed");
    });

    expect(failing).rejects.toThrow("nope");
    await following;
    expect(order).toEqual(["failed", "followed"]);
  });
});
