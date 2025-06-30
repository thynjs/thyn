import { describe, expect, it } from "vitest";
import Counter from "./Counter.thyn";
// import { wait } from "./utils.js";

describe("Counter component", () => {
  it("increments on click", async () => {
    const root = Counter();
    expect(root.textContent).toBe("Count: 0");
    root.click();
    await Promise.resolve();
    expect(root.textContent).toBe("Count: 1");
  });
});
