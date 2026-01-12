import { describe, expect, it } from "vitest";
import EventPipes from "./EventPipes.thyn";

describe("EventPipes component", () => {
  it("pipes event handlers", async () => {
    const root = EventPipes();
    document.body.appendChild(root);
    expect(root.textContent).toBe("00");
    (root.querySelector(".inner") as HTMLElement).click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("10");
    document.body.removeChild(root);
  });
});
