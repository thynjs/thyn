import { describe, expect, it } from "vitest";
import EscapeDollar from "./EscapeDollar.thyn";

describe("EscapeDollar component", () => {
  it("escapes dollar sign", async () => {
    const root = EscapeDollar();
    expect(root.textContent).toBe("$foo");
  });
});
