import { describe, expect, it } from "vitest";
import EventPipes from "./EventPipes.thyn";

describe("EventPipes component", () => {
  it("pipes event handlers", async () => {
    const root = EventPipes();
    expect(root.textContent).toBe("00");
    root.querySelector(".inner").click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.textContent).toBe("10");
  });
});
