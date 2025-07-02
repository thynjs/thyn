import { describe, expect, it } from "vitest";
import Template from "./Template.thyn";

describe("Template component", () => {
  it("finds nested reactive node", async () => {
    const root = Template();
    expect(root.textContent).toBe("foo0");
  });
});
