import { describe, expect, it } from "vitest";
import SharedCounterParent from "./SharedCounterParent.thyn";

describe("SharedCounter with module-level state", () => {
  it("shares module-level signal across all instances", async () => {
    const parent = SharedCounterParent();
    
    // Get all child instances
    const instances = parent.querySelectorAll(".shared-counter-instance");
    expect(instances.length).toBe(3);
    
    // All instances should show the same initial value (0)
    const values = parent.querySelectorAll(".shared-value");
    values.forEach((val) => {
      expect(val.textContent).toBe("0");
    });
    
    // Click the first instance's button
    const firstButton = instances[0].querySelector(".increment-btn");
    firstButton.click();
    await Promise.resolve();
    
    // All instances should now show 1 (shared state)
    values.forEach((val) => {
      expect(val.textContent).toBe("1");
    });
    
    // Click the second instance's button
    const secondButton = instances[1].querySelector(".increment-btn");
    secondButton.click();
    await Promise.resolve();
    
    // All instances should now show 2
    values.forEach((val) => {
      expect(val.textContent).toBe("2");
    });
  });
});
