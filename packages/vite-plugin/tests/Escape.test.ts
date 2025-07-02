import { describe, expect, it } from "vitest";
import Escape from "./Escape.thyn";

describe("Escape component", () => {
  it("escapes curly braces", async () => {
    const root = Escape();
    expect(root.textContent).toBe("{{ foo }}");
  });
});
