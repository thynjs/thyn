import { describe, expect, it } from "vitest";
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
      { if: () => on.get(), then: () => document.createTextNode("on") },
      { then: () => document.createTextNode("off") },
    ]);
    expect(root.textContent).toBe("on");
    on.set(false);
    await wait();
    expect(root.textContent).toBe("off");
  });

  it("if else-if", async () => {
    const on = $signal(true);
    const root = makeShow([
      { if: () => on.get(), then: () => document.createTextNode("on") },
      { if: () => !on.get(), then: () => document.createTextNode("off") },
    ]);
    expect(root.textContent).toBe("on");
    on.set(false);
    await wait();
    expect(root.textContent).toBe("off");
  });

  it("if else-if else", async () => {
    const on = $signal("a");
    const root = makeShow([
      { if: () => on.get() === "a", then: () => document.createTextNode("a") },
      { if: () => on.get() === "b", then: () => document.createTextNode("b") },
      { then: () => document.createTextNode("c") },
    ]);
    expect(root.textContent).toBe("a");
    on.set("b");
    await wait();
    expect(root.textContent).toBe("b");
    on.set("");
    await wait();
    expect(root.textContent).toBe("c");
  });

  it("different signals", async () => {
    const foo = $signal("a");
    const bar = $signal("b");
    const root = makeShow([
      { if: () => foo.get() === "a", then: () => document.createTextNode("foo") },
      { if: () => bar.get() === "a", then: () => document.createTextNode("bar") },
      { then: () => document.createTextNode("c") },
    ]);
    expect(root.textContent).toBe("foo");
    foo.set("b")
    bar.set("a");
    await wait();
    expect(root.textContent).toBe("bar");
  });
});
