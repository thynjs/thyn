import { describe, expect, it } from "vitest";
import Bind from "./Bind.thyn";

describe("Bind component", () => {
  it("has bound class name", async () => {
    const root = Bind();
    expect(root.className).toBe("bar");
  });

  it("does not touch text content", async () => {
    const root = Bind();
    expect(root.textContent).toBe("const n={run:t,deps:new Set,td:null}");
  });
});
