import { describe, expect, it } from "vitest";
import { $effect, $signal } from "../src";
import { wait } from "./utils";

describe("runs effect", () => {
  it("if else", async () => {
    const on = $signal(true);
    const runRef = { val: 0 };
    const tdRef = { val: 0 };
    const root = (() => {
      const div = document.createElement("div");
      $effect(() => { div.textContent = on() ? "on" : "off" });
      $effect(() => {
        on();
        runRef.val++;
        return () => {
          tdRef.val++;
        };
      });
      return div;
    })();
    expect(root.textContent).toBe("on");
    expect(runRef.val).toBe(1);
    expect(tdRef.val).toBe(0);
    on(false);
    await wait();
    expect(root.textContent).toBe("off");
    expect(runRef.val).toBe(2);
    expect(tdRef.val).toBe(1);
  });
});
