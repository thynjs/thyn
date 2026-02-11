import { describe, expect, it } from "vitest";
import LargeList from "./LargeList.thyn";

const wait = () => Promise.resolve();

describe("Large List (> 10000 items)", () => {
  it("renders and updates large lists without stack overflow", async () => {
    const root = LargeList();
    await wait();
    const list = root.querySelector("#list");
    
    const spans = list?.querySelectorAll("span");
    expect(spans?.length).toBeGreaterThan(10000);
    expect(spans?.[spans.length - 1].textContent).toBe("10004");

    // Update
    (root.querySelector("#remove") as HTMLElement)?.click();
    await wait();
    await wait();
    
    const newSpans = list?.querySelectorAll("span");
    expect(newSpans?.[newSpans.length - 1].textContent).toBe("10003");
  });
});
