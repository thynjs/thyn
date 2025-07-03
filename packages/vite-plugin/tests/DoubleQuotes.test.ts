import { describe, expect, it } from "vitest";
import DoubleQuotes from "./DoubleQuotes.thyn";

describe("DoubleQuotes component", () => {
  it("handles double quotes in bound js expression", async () => {
    const root = DoubleQuotes();
    expect(root.textContent).toBe("abc");
  });
});
