import { describe, expect, it } from "vitest";
import { component, createReactiveTextNode } from "../src/element";
import { Router, router } from "../src/router";
import { wait } from "./utils";

function Div(it: string) {
  return () => {
    const div = document.createElement("div");
    div.textContent = it;
    return div;
  };
}

// function makeRouter(routes) {

// }

describe("router", () => {
  it("static routes", async () => {
    const root = document.createElement("div");
    root.appendChild(component(Router, {
      routes: [
        { path: "/foo", component: () => component(Div("foo")) },
        { path: "/bar", component: () => component(Div("bar")) },
      ],
    }));
    router.path("/foo");
    await wait();
    expect(root.textContent).toBe("foo");
    router.path("/bar");
    await wait();
    expect(root.textContent).toBe("bar");
    router.path("/foo");
    await wait();
    expect(root.textContent).toBe("foo");
  });

  it("dynamic routes", async () => {
    const root = document.createElement("div");
    root.appendChild(Router({
      routes: [
        {
          path: "/pages/baz",
          component: () => {
            return document.createTextNode("baz");
          },
        },
        {
          path: "/pages/:id",
          component: () => {
            return createReactiveTextNode(() => router.param("id"))!;
          },
        },
      ],
    }));
    router.path("/pages/foo");
    await wait();
    expect(root.textContent).toBe("foo");
    router.path("/pages/bar");
    await wait();
    expect(root.textContent).toBe("bar");
    router.path("/pages/baz");
    await wait();
    expect(root.textContent).toBe("baz");
    router.path("/pages/foo");
    await wait();
    expect(root.textContent).toBe("foo");
  });
});
