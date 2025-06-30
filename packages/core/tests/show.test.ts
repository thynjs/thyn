import { describe, it, expect } from "vitest";
import { $signal, show } from "../src";
import { wait } from "./utils";

function makeShow(cases: any[]) {
  const root = document.createElement("div");
  root.appendChild(show(cases));
  return root;
}

describe("show", () => {
  it("if else", async () => {
    const on = $signal(true);
    const root = makeShow([
      { if: on, then: () => document.createTextNode("on") },
      { then: () => document.createTextNode("off") },
    ]);
    expect(root.textContent).toBe("on");
    on(false);
    await wait();
    expect(root.textContent).toBe("off");
  });

  it("if else-if", async () => {
    const on = $signal(true);
    const root = makeShow([
      { if: on, then: () => document.createTextNode("on") },
      { if: () => !on(), then: () => document.createTextNode("off") },
    ]);
    expect(root.textContent).toBe("on");
    on(false);
    await wait();
    expect(root.textContent).toBe("off");
  });

  it("if else-if else", async () => {
    const on = $signal("a");
    const root = makeShow([
      { if: () => on() === "a", then: () => document.createTextNode("a") },
      { if: () => on() === "b", then: () => document.createTextNode("b") },
      { then: () => document.createTextNode("c") },
    ]);
    expect(root.textContent).toBe("a");
    on("b");
    await wait();
    expect(root.textContent).toBe("b");
    on("");
    await wait();
    expect(root.textContent).toBe("c");
  });
});
