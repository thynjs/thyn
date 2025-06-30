import { describe, expect, it } from "vitest";
import Show from "./Show.thyn";

describe("Show component", () => {
  it("swaps on click", async () => {
    const root = Show();
    expect(root.textContent).toBe("foo");
    root.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("bar");
  });
});
