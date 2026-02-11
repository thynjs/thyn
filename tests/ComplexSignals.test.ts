import { describe, expect, it } from "vitest";
import ComplexSignals from "./ComplexSignals.thyn";

const wait = () => Promise.resolve();

describe("Complex Signals", () => {
  it("updates derived signals and conditional effects", async () => {
    const root = ComplexSignals();
    await wait();
    const res = root.querySelector("#res");
    
    expect(res?.textContent).toBe("0:0:Low");
    
    const btn = root.querySelector("button") as HTMLElement;
    
    // 1
    btn?.click();
    await wait();
    await wait(); 
    expect(res?.textContent).toBe("1:2:Low");
    
    // 2
    btn?.click();
    await wait();
    await wait();
    expect(res?.textContent).toBe("2:4:Low");
    
    // 3
    btn?.click();
    await wait();
    await wait();
    expect(res?.textContent).toBe("3:6:High");
  });
});
