import { $effect, cleanup } from "./signals";

export function mount(app, parent) {
  parent.appendChild(app());
}

const effects = new Map();
export let currentEffects: any | undefined;

export function createReactiveTextNode(v) {
  let n;
  $effect(() => {
    if (n) {
      n.nodeValue = v();
    } else {
      n = document.createTextNode(v());
    }
  });
  return n;
}

export function component(name, props?: any) {
  const prevEffects = currentEffects;
  currentEffects = [];
  const e = name(props);
  const existing = effects.get(e);
  if (existing) {
    existing.push(...currentEffects);
  } else {
    effects.set(e, currentEffects);
  }
  currentEffects = prevEffects;
  return e;
}

export function setAttribute(el, key, val) {
  if (val) el.setAttribute(key, val);
  return el;
}
export function setProperty(el, key, val) {
  if (val) el[key] = val;
  return el;
}
export function setReactiveAttribute(el, key, val) {
  let first = true;
  addEffect(
    el,
    $effect(() => {
      const v = val();
      if (first) {
        if (v !== undefined) el.setAttribute(key, val());
        first = false;
        return;
      }
      if (v === undefined) el.removeAttribute(key);
      else el.setAttribute(key, v);
    }),
  );
  return el;
}
export function setReactiveProperty(el, key, val) {
  let first = true;
  addEffect(
    el,
    $effect(() => {
      const v = val();
      if (first) {
        if (v !== undefined) el[key] = v;
        first = false;
        return;
      }
      if (v === undefined) delete el[key];
      else el[key] = v;
    }),
  );
  return el;
}

export function addChildren(e, children) {
  for (const ch of children) {
    e.appendChild(ch);
  }
  return e;
}

export function markAsReactive(el) {
  if (!effects.has(el)) effects.set(el, []);
  return el;
}

export function addEffect(el, ef) {
  if (effects.has(el)) {
    effects.get(el).push(ef);
  } else {
    effects.set(el, [ef]);
  }
  return el;
}

function teardown(elem, iterating = false) {
  let end;
  let start;
  if (elem.nodeType === 8) { // COMMENT_NODE
    const bookends = fragments.get(elem);
    if (!bookends) {
      return;
    }
    fragments.delete(elem);
    start = elem;
    [elem, end] = bookends;
  }
  const fx = effects.get(elem);
  if (fx) {
    for (const eff of fx) {
      cleanup(eff);
    }
    effects.delete(elem);
    if (end && elem.nodeType === 11) { // DOCUMENT_FRAGMENT_NODE
      if (iterating) return;
      while (end.previousSibling !== start) {
        teardown(end.previousSibling);
        end = end.previousSibling;
      }
    } else {
      for (const ch of elem.childNodes) {
        teardown(ch, true);
      }
    }
  }
}

function remove(elem) {
  if (!elem.parentNode) {
    const [, end] = fragments.get(elem);
    if (!elem.previousSibling && !end.nextSibling) {
      elem.parentNode.textContent = "";
      return;
    }
    while (end.previousSibling !== elem) {
      end.previousSibling.remove();
    }
    end.remove();
  }
  elem.remove();
}

export function show(props) {
  let prevIndex = -1;
  let prevElem: Element | Comment | undefined;

  const eff = $effect(() => {
    const currIndex = props.findIndex((c) => !c.if || c.if());
    if (currIndex === prevIndex) {
      if (!prevElem) {
        prevElem = document.createComment("");
      }
      return;
    }
    const newElem = currIndex < 0 ? document.createComment("") : props[currIndex].then();
    if (prevElem) {
      const prevFx = effects.get(prevElem);
      if (prevFx) {
        effects.set(prevElem, prevFx.filter((f) => f !== eff));
      }
      const fx = effects.get(newElem);
      if (fx) {
        fx.push(eff);
      } else {
        effects.set(newElem, [eff]);
      }
      let td = prevElem;
      queueMicrotask(() => {
        teardown(td);
        td.replaceWith(newElem);
        td = null;
      });
    }
    prevElem = newElem;
    prevIndex = currIndex;
  });

  return prevElem;
}

const replaceWith = (nextItem, prevElement, render) => {
  teardown(prevElement);
  prevElement.replaceWith(render(nextItem));
};

const fragments = new Map();

export function terminalList(props) {
  return list(props, true);
}

export function list(props, terminal = false) {
  let prevItems;
  let outlet = document.createDocumentFragment();
  const startBookend = document.createComment("") as ChildNode;
  const endBookend = document.createComment("") as ChildNode;
  const render = props.render;
  const keyMap = new Map();
  let isolated = false;

  $effect(() => {
    const parent = startBookend.parentNode;
    if (!parent) {
      prevItems = props.items();
      for (const i of prevItems) {
        outlet.appendChild(render(i));
      }
      return;
    }
    let nextItems = props.items();
    let newLength = nextItems.length;
    let oldLength = prevItems.length;
    if (!oldLength && newLength) {
      for (const i of nextItems) {
        parent.insertBefore(render(i), endBookend);
      }
      prevItems = nextItems;
      return;
    }
    if (!newLength && isolated) {
      const end = parent.childNodes.length - 1;
      if (terminal) {
        for (let i = 1; i < end; i++) {
          const ch = parent.childNodes[i];
          for (const f of effects.get(ch)) cleanup(f);
          effects.delete(ch);
        }
      } else {
        for (let i = 1; i < parent.childNodes.length - 1; i++) {
          teardown(parent.childNodes[i]);
        }
      }
      parent.textContent = "";
      parent.append(startBookend, endBookend);
      prevItems = nextItems;
      return;
    }

    let start = nextItems.findIndex((item, index) => prevItems[index] !== item);
    if (start === oldLength) {
      for (let i = start; i < newLength; i++) {
        parent.insertBefore(render(nextItems[i]), endBookend);
      }
      prevItems = nextItems;
      return;
    }

    const childNodes = Array.from(parent.childNodes);
    const offset = childNodes.indexOf(startBookend) + 1;
    if (start < 0) {
      for (let i = nextItems.length; i < oldLength; i++) {
        const e = childNodes[offset + --oldLength];
        teardown(e);
        remove(e);
      }
      prevItems = nextItems;
      return;
    }

    if (start >= newLength) {
      while (start < oldLength) {
        const e = childNodes[offset + --oldLength];
        teardown(e);
        remove(e);
      }
      prevItems = nextItems;
      return;
    }

    // suffix
    oldLength--;
    newLength--;
    while (
      newLength > start &&
      oldLength >= start &&
      (nextItems[newLength] === prevItems[oldLength])
    ) {
      oldLength--;
      newLength--;
    }

    const nextKeys = new Set(nextItems);
    let rem = [];
    for (let i = start; i <= oldLength; i++) {
      if (!nextKeys.has(prevItems[i])) {
        const ch = childNodes[i + offset];
        if (terminal) {
          for (const f of effects.get(ch)) cleanup(f);
          effects.delete(ch);
        } else {
          teardown(ch);
        }
        rem.push(ch);
        childNodes[i + offset] = null;
      }
    }
    if (isolated && rem.length === prevItems.length) {
      parent.textContent = "";
      parent.appendChild(startBookend);
      for (const i of nextItems) {
        parent.appendChild(render(i));
      }
      parent.appendChild(endBookend);
      prevItems = nextItems;
      rem = null;
      return;
    }
    for (const e of rem) {
      remove(e);
    }
    rem = null;
    for (let i = start; i <= oldLength; i++) {
      if (
        childNodes[i + offset] &&
        (!nextItems[i] ||
          prevItems[i] !== nextItems[i])
      ) {
        keyMap.set(prevItems[i], {
          element: childNodes[i + offset],
          item: prevItems[i],
        });
      }
    }
    if (newLength === oldLength && keyMap.size > (newLength - start + 1) / 2) {
      const lastOrdered = childNodes[start + offset - 1];
      const set = [];
      for (let i = start; i <= newLength; i++) {
        set.push(
          keyMap.get(nextItems[i])?.element ?? childNodes[i + offset],
        );
      }
      lastOrdered.after(...set);
      prevItems = nextItems;
      keyMap.clear();
      return;
    }

    while (start <= newLength) {
      const newChd = nextItems[start];
      const oldChd = prevItems[start];
      const oldDom = parent!.childNodes[start + offset];
      const mappedOld = keyMap.get(newChd);
      if (oldChd === undefined) {
        endBookend.before(render(newChd));
      } else if (mappedOld) {
        if (oldDom !== mappedOld.element) {
          const tmp = mappedOld.element.nextSibling;
          parent.insertBefore(mappedOld.element, oldDom);
          parent.insertBefore(oldDom, tmp);
        }
        if (mappedOld.item !== newChd) {
          replaceWith(newChd, mappedOld.element, render);
        }
        keyMap.delete(newChd);
      } else if (oldChd !== newChd) {
        parent.insertBefore(render(newChd), oldDom);
      }
      start++;
    }
    for (const v of keyMap.values()) {
      const el = v.element;
      teardown(el);
      remove(el);
    }
    keyMap.clear();
    prevItems = nextItems;
    nextItems = null;
  });
  outlet.prepend(startBookend);
  outlet.append(endBookend);
  fragments.set(startBookend, [outlet, endBookend]);
  isolated = !startBookend.previousSibling && !endBookend.nextSibling;
  return outlet;
}
