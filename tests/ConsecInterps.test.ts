import { describe, expect, it } from "vitest";
import ConsecInterps from "./ConsecInterps.thyn";

describe("ConsecInterps component", () => {
  it("renders", async () => {
    const root = ConsecInterps();
    expect(root.textContent).toBe("00");
  });
});
