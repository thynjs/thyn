import { describe, it, expect } from "vitest";
import Counter from "./Counter.thyn";
import { wait } from "./utils.ts";

describe("Counter component", () => {
  it("increments on click", async () => {
    const root = Counter();
    expect(root.textContent).toBe("Count: 0");
    root.click();
    await wait();
    expect(root.textContent).toBe("Count: 1");
  });
});
