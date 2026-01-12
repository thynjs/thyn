import { describe, expect, it } from "vitest";
import { $signal, isolatedTerminalList, list } from "../src";
import { wait } from "./utils";

function makeGenericList(signal: any) {
  return list({
    items: () => signal.get(),
    render: (item: number) => {
      const span = document.createElement("span");
      span.textContent = `${item}`;
      return span;
    },
  });
}

function makeIsolatedTerminalList(signal: any) {
  return isolatedTerminalList({
    items: () => signal.get(),
    render: (item: number) => {
      const span = document.createElement("span");
      span.textContent = `${item}`;
      return span;
    },
  });
}

const run = (makeList: any) => describe("list", () => {
  it("renders", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    expect(root.textContent).toBe("012");
  });

  it("removes all", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items.set([]);
    await wait();
    expect(root.textContent).toBe("");
  });

  if (makeList === makeGenericList) {
    it("removes all when offset 1", async () => {
      const items = $signal([0, 1, 2, 3]);
      const root = document.createElement("div");
      const a = document.createElement("span");
      a.textContent = "a";
      const b = document.createElement("span");
      b.textContent = "b";
      const div = makeList(items);
      root.append(a, div, b);
      expect(root.textContent).toBe("a0123b");
      items.set([]);
      await wait();
      expect(root.textContent).toBe("ab");
    });

    it("removes all when offset 2", async () => {
      const items = $signal([0, 1, 2, 3]);
      const root = document.createElement("div");
      const a = document.createElement("span");
      a.textContent = "a";
      const b = document.createElement("span");
      b.textContent = "b";
      const c = document.createElement("span");
      c.textContent = "c";
      const d = document.createElement("span");
      d.textContent = "d";
      const div = makeList(items);
      root.append(a, b, div, c, d);
      expect(root.textContent).toBe("ab0123cd");
      items.set([]);
      await wait();
      expect(root.textContent).toBe("abcd");
    });
  }

  it("stays the same", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items.set([0, 1]);
    await wait();
    expect(root.textContent).toBe("01");
  });

  it("reverses 2", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items.set([1, 0]);
    await wait();
    expect(root.textContent).toBe("10");
  });

  it("reverses 3", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items.set([2, 1, 0]);
    await wait();
    expect(root.textContent).toBe("210");
  });

  it("reverses 4", async () => {
    const items = $signal([0, 1, 2, 3]);
    const root = makeList(items);
    items.set([3, 2, 1, 0]);
    await wait();
    expect(root.textContent).toBe("3210");
  });

  it("removes from start", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items.set([1, 2]);
    await wait();
    expect(root.textContent).toBe("12");
  });

  it("removes from end", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items.set([0, 1]);
    await wait();
    expect(root.textContent).toBe("01");
  });

  it("removes from middle", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items.set([0, 2]);
    await wait();
    expect(root.textContent).toBe("02");
  });

  it("removes from everywhere", async () => {
    const items = $signal([0, 1, 2, 3, 4, 5, 6]);
    const root = makeList(items);
    items.set([1, 3, 5]);
    await wait();
    expect(root.textContent).toBe("135");
  });

  it("adds to start", async () => {
    const items = $signal([1, 2]);
    const root = makeList(items);
    items.set([0, 1, 2]);
    await wait();
    expect(root.textContent).toBe("012");
  });

  it("adds to end", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items.set([0, 1, 2]);
    await wait();
    expect(root.textContent).toBe("012");
  });

  it("adds to middle", async () => {
    const items = $signal([0, 2]);
    const root = makeList(items);
    items.set([0, 1, 2]);
    await wait();
    expect(root.textContent).toBe("012");
  });

  it("replaces all", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items.set([2, 3]);
    await wait();
    expect(root.textContent).toBe("23");
  });

  it("sorts", async () => {
    const items = $signal([6, 0, 2, 4, 7, 1, 3, 5]);
    const root = makeList(items);
    items.set([0, 1, 2, 3, 4, 5, 6, 7]);
    await wait();
    expect(root.textContent).toBe("01234567");
  });
});

run(makeGenericList);
run(makeIsolatedTerminalList);