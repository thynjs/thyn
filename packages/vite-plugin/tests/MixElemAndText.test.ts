import { describe, expect, it } from "vitest";
import MixElemAndText from "./MixElemAndText.thyn";

describe("MixElemAndText component", () => {
  it("renders", async () => {
    const root = MixElemAndText();
    expect(root.textContent).toBe("00");
  });
});
