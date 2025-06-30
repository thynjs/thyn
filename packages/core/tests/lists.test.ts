import { describe, it, expect } from "vitest";
import { $signal, list, Signal } from "../src";
import { wait } from "./utils";

function makeList(signal: Signal<any>) {
  return list({
    items: () => signal(),
    render: (item: number) => {
      const span = document.createElement("span");
      span.textContent = `${item}`;
      return span;
    },
  });
}

describe("list", () => {
  it("renders", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    expect(root.textContent).toBe("012");
  });

  it("removes all", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items([]);
    await wait();
    expect(root.textContent).toBe("");
  });

  it("stays the same", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items([0, 1]);
    await wait();
    expect(root.textContent).toBe("01");
  });

  it("reverses 2", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items([1, 0]);
    await wait();
    expect(root.textContent).toBe("10");
  });

  it("reverses 3", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items([2, 1, 0]);
    await wait();
    expect(root.textContent).toBe("210");
  });

  it("reverses 4", async () => {
    const items = $signal([0, 1, 2, 3]);
    const root = makeList(items);
    items([3, 2, 1, 0]);
    await wait();
    expect(root.textContent).toBe("3210");
  });

  it("removes from start", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items([1, 2]);
    await wait();
    expect(root.textContent).toBe("12");
  });

  it("removes from end", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items([0, 1]);
    await wait();
    expect(root.textContent).toBe("01");
  });

  it("removes from middle", async () => {
    const items = $signal([0, 1, 2]);
    const root = makeList(items);
    items([0, 2]);
    await wait();
    expect(root.textContent).toBe("02");
  });

  it("removes from everywhere", async () => {
    const items = $signal([0, 1, 2, 3, 4, 5, 6]);
    const root = makeList(items);
    items([1, 3, 5]);
    await wait();
    expect(root.textContent).toBe("135");
  });

  it("adds to start", async () => {
    const items = $signal([1, 2]);
    const root = makeList(items);
    items([0, 1, 2]);
    await wait();
    expect(root.textContent).toBe("012");
  });

  it("adds to end", async () => {
    const items = $signal([0, 1]);
    const root = makeList(items);
    items([0, 1, 2]);
    await wait();
    expect(root.textContent).toBe("012");
  });

  it("adds to middle", async () => {
    const items = $signal([0, 2]);
    const root = makeList(items);
    items([0, 1, 2]);
    await wait();
    expect(root.textContent).toBe("012");
  });

  it("sorts", async () => {
    const items = $signal([6, 0, 2, 4, 7, 1, 3, 5]);
    const root = makeList(items);
    items([0, 1, 2, 3, 4, 5, 6, 7]);
    await wait();
    expect(root.textContent).toBe("01234567");
  });
});
