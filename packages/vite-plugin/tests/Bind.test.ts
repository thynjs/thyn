import { describe, expect, it } from "vitest";
import Bind from "./Bind.thyn";
// import { wait } from "./utils.js";

describe("Bind component", () => {
  it("has bound class name", async () => {
    const root = Bind();
    expect(root.className).toBe("bar");
  });
});
