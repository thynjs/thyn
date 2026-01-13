import { describe, expect, it } from "vitest";
import NestedBraces from "./NestedBraces.thyn";

describe("NestedBraces component", () => {
  it("handles object literal", async () => {
    const root = NestedBraces();
    expect(root.textContent).toBe("1");
  });
});
