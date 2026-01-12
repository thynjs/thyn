import { describe, expect, it } from "vitest";
import { $effect, $signal } from "../src";
import { wait } from "./utils";

describe("optimization", () => {
  it("deduplicates scheduled effects", async () => {
    const count = $signal(0);
    let runs = 0;

    $effect(() => {
      count.get();
      runs++;
    });

    expect(runs).toBe(1); // Initial run

    // Update multiple times synchronously
    count.set(1);
    count.set(2);
    count.set(3);

    await wait();

    // Should only run once more (for the final value or batched)
    // Actually, with deduplication, the effect is added once to the set.
    // When microtask runs, it executes.
    // So runs should be 2.
    expect(runs).toBe(2);
    expect(count.get()).toBe(3);
  });

  it("deduplicates redundant updates", async () => {
    const s1 = $signal(0);
    const s2 = $signal(0);
    let runs = 0;

    $effect(() => {
        s1.get();
        s2.get();
        runs++;
    });

    expect(runs).toBe(1);

    // Update both signals synchronously. Both trigger the same effect.
    // Without dedupe, effect might run twice.
    s1.set(1);
    s2.set(1);

    await wait();

    expect(runs).toBe(2);
  });

  it("subscribe method works", async () => {
      const s = $signal(10);
      let val = 0;
      const sub = s.subscribe((v) => {
          val = v;
      });

      expect(val).toBe(10);

      s.set(20);
      await wait();
      expect(val).toBe(20);

      // Cleanup manually for test (usually element teardown does this)
      s.delete(sub);

      s.set(30);
      await wait();
      expect(val).toBe(20); // Should not update
  });
});
