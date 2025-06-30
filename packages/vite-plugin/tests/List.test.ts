import { describe, expect, it } from "vitest";
import List from "./List.thyn";

describe("List component", () => {
  it("appends on click", async () => {
    const root = List();
    expect(root.textContent).toBe("012");
    root.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("0123");
  });
});
