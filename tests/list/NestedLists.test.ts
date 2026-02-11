import { describe, expect, it } from "vitest";
import NestedLists from "./NestedLists.thyn";

const wait = () => Promise.resolve();

describe("Nested Lists", () => {
  it("removes parent item and tears down children correctly", async () => {
    const root = NestedLists();
    await wait();
    
    expect(root.querySelectorAll(".parent").length).toBe(2);
    expect(root.querySelectorAll(".child").length).toBe(3); // a, b, c
    
    (root.querySelector("#remove") as HTMLElement)?.click();
    await wait();
    await wait();
    
    expect(root.querySelectorAll(".parent").length).toBe(1);
    expect(root.querySelectorAll(".child").length).toBe(1); // c
    
    const text = root.querySelector("#list")?.textContent;
    expect(text).not.toContain("a");
    expect(text).not.toContain("b");
    expect(text).toContain("c");
  });
});
