import { describe, expect, it } from "vitest";
import List from "./List.thyn";

describe("List component", () => {
  it("appends on click", async () => {
    const root = List();
    document.body.appendChild(root);
    expect(root.textContent).toBe("start012end");
    root.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("start0123end");
    root.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("startend");
    root.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("start0end");
    document.body.removeChild(root);
  });
});
