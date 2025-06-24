import { component, element, first, list, show } from "/element.js";
import { effect, signal } from "/signals.js";
import { assertEqual, it, mount, wait } from "/tests/test.js";

it("creates element", () => {
  const p = element("p", { slot: ["foo"] });
  mount(p);
  assertEqual(p.textContent, "foo");
});

it("button disabled", async () => {
  const [count, setCount] = signal(0);
  const btn = element("button", {
    disabled: true,
    onclick: () => setCount(c => c + 1),
    slot: [count],
  });
  mount(btn);
  assertEqual(btn.textContent, "0");
  btn.click();
  await wait();
  assertEqual(btn.textContent, "0");
});

it("sets aria- attributes", () => {
  const btn = element("button", { "aria-label": "foo" });
  mount(btn);
  assertEqual(btn.getAttribute("aria-label"), "foo");
});

it("sets aria- properties", () => {
  const btn = element("button", { ariaLabel: "foo" });
  mount(btn);
  assertEqual(btn.getAttribute("aria-label"), "foo");
});

it("sets aria- attributes", () => {
  const btn = element("button", { ariaLabel: "foo" });
  mount(btn);
  assertEqual(btn.getAttribute("aria-label"), "foo");
});

it("sets data- attributes", () => {
  const btn = element("button", { "data-foo": "foo" });
  mount(btn);
  assertEqual(btn.dataset.foo, "foo");
});

it("set class name", () => {
  const btn = element("button", { class: "foo" });
  mount(btn);
  assertEqual(btn.classList.contains("foo"), true);
});

it("don't set class name if undefined", () => {
  const btn = element("button", { class: undefined });
  mount(btn);
  assertEqual(btn.classList.length, 0);
});

it("don't set class name if null", () => {
  const btn = element("button", { class: false });
  mount(btn);
  assertEqual(btn.classList.length, 0);
});

it("remove class name if changed to undefined", async () => {
  const [className, setClassName] = signal("foo")
  const btn = element("button", { class: className, onclick: () => setClassName(n => n ? undefined : "foo") });
  mount(btn);
  assertEqual(btn.classList.contains("foo"), true);
  btn.click();
  await wait();
  assertEqual(btn.classList.length, 0);
});

it("creates component", () => {
  const p = props => element("p", { slot: [props.text] });
  const div = element("div", {
    slot: [component(p, { text: "foo" })],
  });
  mount(div);
  assertEqual(div.textContent, "foo");
});

it("first with no default first component", () => {
  const div = element("div", {
    slot: [component(first, {
      cases: [],
    })],
  });
  mount(div);
  assertEqual(div.textContent, "");
});

it("first with default first component", () => {
  const div = element("div", {
    slot: [component(first, {
      cases: [],
      default: () => element("p", { slot: ["foo"] }),
    })],
  });
  mount(div);
  assertEqual(div.textContent, "foo");
});

it("show then to empty", async () => {
  const [vis, setVis] = signal(true);
  const div = element("div", {
    slot: [component(show, {
      if: vis,
      then: () => element("p", { slot: ["foo"] }),
    })],
    onclick: () => setVis(v => !v),
  });
  mount(div);
  assertEqual(div.textContent, "foo");
  div.click();
  await wait();
  assertEqual(div.textContent, "");
  div.click();
  await wait();
  assertEqual(div.textContent, "foo");
});

it("show empty to then", async () => {
  const [vis, setVis] = signal(false);
  const div = element("div", {
    slot: [component(show, {
      if: vis,
      then: () => element("p", { slot: ["foo"] }),
    })],
    onclick: () => setVis(v => !v),
  });
  mount(div);
  assertEqual(div.textContent, "");
  div.click();
  await wait();
  assertEqual(div.textContent, "foo");
  div.click();
  await wait();
  assertEqual(div.textContent, "");
});

it("show true to else", async () => {
  const [vis, setVis] = signal(true);
  const div = element("div", {
    slot: [component(show, {
      if: vis,
      then: () => element("p", { slot: ["foo"] }),
      else: () => element("p", { slot: ["bar"] }),
    })],
    onclick: () => setVis(v => !v),
  });
  mount(div);
  assertEqual(div.textContent, "foo");
  div.click();
  await wait();
  assertEqual(div.textContent, "bar");
  div.click();
  await wait();
  assertEqual(div.textContent, "foo");
});

it("responds to signal in slot", async () => {
  const [count, setCount] = signal(0);
  const p = element("p", {
    slot: [count],
    onclick: () => setCount(c => c + 1),
  });
  mount(p);
  assertEqual(p.textContent, "0");
  p.click();
  await wait();
  assertEqual(p.textContent, "1");
});

it("responds to signal in class name", async () => {
  const [name, setName] = signal("foo");
  const p = element("p", {
    class: name,
    onclick: () => setName("bar"),
  });
  mount(p);
  assertEqual(p.className, "foo");
  p.click();
  await wait();
  assertEqual(p.className, "bar");
});

it("responds to computed signal", async () => {
  const [count, setCount] = signal(0);
  const double = () => count() * 2;
  const p = element("p", {
    slot: [double],
    onclick: () => setCount(c => c + 1),
  });
  mount(p);
  assertEqual(p.textContent, "0");
  p.click();
  await wait();
  assertEqual(p.textContent, "2");
  p.click();
  await wait();
  assertEqual(p.textContent, "4");
});

it("list: siblings - append to empty", async () => {
  const [nums, setNums] = signal([]);
  const div = element("div", {
    slot: [
      element("p", { slot: ["foo"] }),
      component(list, {
        items: nums,
        key: n => n,
        render: n => element("p", { slot: [n] }),
      }),
      element("p", { slot: ["bar"] }),
    ],
    onclick: () => setNums(old => [...old, old.length]),
  });
  mount(div);
  assertEqual(div.textContent, "foobar");
  div.click();
  await wait();
  assertEqual(div.textContent, "foo0bar");
  div.click();
  await wait();
  assertEqual(div.textContent, "foo01bar");
});

it("list: siblings - modify", async () => {
  const [nums, setNums] = signal([0, 1]);
  const div = element("div", {
    slot: [
      element("p", { slot: ["foo"] }),
      component(list, {
        items: nums,
        key: n => n,
        render: n => element("p", { slot: [n] }),
      }),
      element("p", { slot: ["bar"] }),
    ],
    onclick: () => setNums([2, 3]),
  });
  mount(div);
  assertEqual(div.textContent, "foo01bar");
  div.click();
  await wait();
  assertEqual(div.textContent, "foo23bar");
});

it("list: append to empty", async () => {
  const [nums, setNums] = signal([]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(old => [...old, old.length]),
  });
  mount(div);
  assertEqual(div.textContent, "");
  div.click();
  await wait();
  assertEqual(div.textContent, "0");
  div.click();
  await wait();
  assertEqual(div.textContent, "01");
});

it("list: reverse 2", async () => {
  const [nums, setNums] = signal([0, 1]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => {
      const nns = [...ns];
      nns.reverse();
      return nns;
    }),
  });
  mount(div);
  assertEqual(div.textContent, "01");
  div.click();
  await wait();
  assertEqual(div.textContent, "10");
  div.click();
  await wait();
  assertEqual(div.textContent, "01");
});

it("list: reverse 3", async () => {
  const [nums, setNums] = signal([0, 1, 2]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => {
      const nns = [...ns];
      nns.reverse();
      return nns;
    }),
  });
  mount(div);
  assertEqual(div.textContent, "012");
  div.click();
  await wait();
  assertEqual(div.textContent, "210");
  div.click();
  await wait();
  assertEqual(div.textContent, "012");
});

it("list: reverse 4", async () => {
  const [nums, setNums] = signal([0, 1, 2, 3]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => {
      const nns = [...ns];
      nns.reverse();
      return nns;
    }),
  });
  mount(div);
  assertEqual(div.textContent, "0123");
  div.click();
  await wait();
  assertEqual(div.textContent, "3210");
  div.click();
  await wait();
  assertEqual(div.textContent, "0123");
});

it("list: sort", async () => {
  const [nums, setNums] = signal([2, 3, 1, 0, 8, 4, 5, 6, 7]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => {
      const nns = [...ns];
      nns.sort();
      return nns;
    }),
  });
  mount(div);
  assertEqual(div.textContent, "231084567");
  div.click();
  await wait();
  assertEqual(div.textContent, "012345678");
});

it("list: append", async () => {
  const [nums, setNums] = signal([0, 1]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => [...ns, ns.length]),
  });
  mount(div);
  assertEqual(div.textContent, "01");
  div.click();
  await wait();
  assertEqual(div.textContent, "012");
  div.click();
  await wait();
  assertEqual(div.textContent, "0123");
});

it("list: replace all", async () => {
  const [nums, setNums] = signal([0, 1]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(() => [2, 3]),
  });
  mount(div);
  assertEqual(div.textContent, "01");
  div.click();
  await wait();
  assertEqual(div.textContent, "23");
});

it("list: splice", async () => {
  const [nums, setNums] = signal([0, 1]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(() => [0, 2, 1]),
  });
  mount(div);
  assertEqual(div.textContent, "01");
  div.click();
  await wait();
  assertEqual(div.textContent, "021");
});

it("list: prepend", async () => {
  const [nums, setNums] = signal([0]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => [ns.length, ...ns]),
  });
  mount(div);
  assertEqual(div.textContent, "0");
  div.click();
  await wait();
  assertEqual(div.textContent, "10");
  div.click();
  await wait();
  assertEqual(div.textContent, "210");
});

it("list: truncate", async () => {
  const [nums, setNums] = signal([0, 1, 2, 3]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => ns.slice(0, -1)),
  });
  mount(div);
  assertEqual(div.textContent, "0123");
  div.click();
  await wait();
  assertEqual(div.textContent, "012");
  div.click();
  await wait();
  assertEqual(div.textContent, "01");
});

it("list: remove from middle", async () => {
  const [nums, setNums] = signal([0, 1, 2, 3]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => ns.filter((_, i) => i !== 1)),
  });
  mount(div);
  assertEqual(div.textContent, "0123");
  div.click();
  await wait();
  assertEqual(div.textContent, "023");
  div.click();
  await wait();
  assertEqual(div.textContent, "03");
});

it("list: insert into middle", async () => {
  const [nums, setNums] = signal([0, 1, 2, 3]);
  const div = element("div", {
    slot: [component(list, {
      
      items: nums,
      key: n => n,
      render: n => element("p", { slot: [n] }),
    })],
    onclick: () => setNums(ns => [...ns.slice(0, 1), ns.length, ...ns.slice(1)]),
  });
  mount(div);
  assertEqual(div.textContent, "0123");
  div.click();
  await wait();
  assertEqual(div.textContent, "04123");
  div.click();
  await wait();
  assertEqual(div.textContent, "054123");
});

it("list: new content", async () => {
  const [foos, setFoos] = signal([
    { id: 1, foo: "bar" },
    { id: 2, foo: "baz" },
  ]);
  const div = element("div", {
    slot: [component(list, {
      
      items: foos,
      key: foo => foo.id,
      render: foo => element("p", { slot: foo.foo }),
    })],
    onclick: () => setFoos(ns => ns.map(f => f.id === 1 ? { id: 1, foo: "bat" } : f)),
  });
  mount(div);
  assertEqual(div.textContent, "barbaz");
  div.click();
  await wait();
  assertEqual(div.textContent, "batbaz");
});

it("list: new item refs memo no change", async () => {
  const renderCnt = { value: 0 };
  const getFoos = () => [
    { id: 1, foo: "bar" },
    { id: 2, foo: "baz" },
  ];
  const [foos, setFoos] = signal(getFoos());
  const div = element("div", {
    slot: [component(list, {
      
      items: foos,
      key: foo => foo.id,
      memo: foo => [foo.id],
      render: foo => {
        renderCnt.value++;
        return element("p", { slot: foo.foo });
      },
    })],
    onclick: () => setFoos(getFoos()),
  });
  mount(div);
  assertEqual(div.textContent, "barbaz");
  assertEqual(renderCnt.value, 2);
  div.click();
  await wait();
  assertEqual(div.textContent, "barbaz");
  assertEqual(renderCnt.value, 2);
});

it("unmount component", async () => {
  const unmounted = { value: false };
  const foo = () => {
    effect(() => () => unmounted.value = true);
    return element("p", { slot: ["foo"] });
  };
  const [show, setShow] = signal(true);
  const div = element("div", {
    slot: [
      element("button", {
        slot: "remove",
        onclick: () => setShow(s => !s),
      }),
      component(first, {
        cases: [{ condition: show, element: () => component(foo) }],
      }),
    ],
  });
  mount(div);
  assertEqual(div.textContent, "removefoo");
  const btn = div.querySelector("button");
  btn.click();
  await wait();
  assertEqual(div.textContent, "remove");
  assertEqual(unmounted.value, true);
});
