import { describe, expect, it } from "vitest";
import List from "./ListV2.thyn";

describe("List component", () => {
  it("appends on click", async () => {
    const root = List();
    expect(root.textContent).toBe("start012end");
    expect(root.querySelector(".selected").id).toBe("1");
    root.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("start0123end");
    expect(root.querySelector(".selected").id).toBe("1");
    root.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("startend");
    expect(root.querySelector(".selected")).toBeFalsy();
  });
});
