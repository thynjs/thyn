import { $effect, cleanup } from "./signals.js";

export function mount(app, parent) {
  parent.appendChild(app());
}

const effects = new Map<Node, any[]>();
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
    if (existing.some(f => f.show)) {
      for (const f of currentEffects) {
        f.show = true;
      }
    }
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
  let ran;
  addEffect(
    el,
    $effect(() => {
      const v = val();
      if (ran) {
        if (v === undefined) el.removeAttribute(key);
        else el.setAttribute(key, v);
        return;
      }
      if (v !== undefined) el.setAttribute(key, val());
      ran = true;
    }),
  );
  return el;
}
export function setReactiveProperty(el, key, val) {
  let ran = true;
  addEffect(
    el,
    $effect(() => {
      const v = val();
      if (ran) {
        if (v === undefined) delete el[key];
        else el[key] = v;
        return;
      }
      if (v !== undefined) el[key] = v;
      ran = true;
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
  let prevElem: Element | Comment;

  $effect(() => {
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
      let sticky = [];
      if (prevFx) {
        sticky = prevFx.filter(f => f.show);
        effects.set(prevElem, prevFx.filter(f => !f.show));
      }
      const fx = effects.get(newElem);
      if (fx) {
        fx.push(...sticky);
      } else {
        effects.set(newElem, sticky);
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
  }, true);

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
  const teardownNode = terminal ? (e: Node) => {
    for (const f of effects.get(e)) cleanup(f);
    effects.delete(e);
  } : teardown;
  let prevItems;
  let outlet = document.createDocumentFragment();
  const startBookend = document.createComment("") as ChildNode;
  const endBookend = document.createComment("") as ChildNode;
  const render = props.render;
  const keyMap = new Map();
  let isolated;
  const nextKeys = new Set();
  const removalQueue = [];

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
    const childNodeList = parent.childNodes;
    if (!newLength && isolated) {
      const end = childNodeList.length - 1;
      for (let i = 1; i < end; i++) {
        teardownNode(childNodeList[i]);
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

    const childNodes = Array.from(childNodeList);
    const offset = childNodes.indexOf(startBookend) + 1;
    if (start < 0) {
      for (let i = nextItems.length; i < oldLength; i++) {
        const e = childNodes[offset + --oldLength];
        teardownNode(e);
        remove(e);
      }
      prevItems = nextItems;
      return;
    }

    if (start >= newLength) {
      while (start < oldLength) {
        const e = childNodes[offset + --oldLength];
        teardownNode(e);
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

    for (const i of nextItems) nextKeys.add(i);
    for (let i = start; i <= oldLength; i++) {
      if (!nextKeys.has(prevItems[i])) {
        const ch = childNodes[i + offset];
        teardownNode(ch);
        removalQueue.push(ch);
        childNodes[i + offset] = null;
      }
    }
    nextKeys.clear();
    if (isolated && removalQueue.length === prevItems.length) {
      parent.textContent = "";
      parent.appendChild(startBookend);
      for (const i of nextItems) {
        parent.appendChild(render(i));
      }
      parent.appendChild(endBookend);
      prevItems = nextItems;
      removalQueue.length = 0;
      return;
    }
    for (const e of removalQueue) {
      remove(e);
    }
    removalQueue.length = 0;
    for (let i = start; i <= oldLength; i++) {
      if (
        childNodes[i + offset] &&
        (!nextItems[i] ||
          prevItems[i] !== nextItems[i])
      ) {
        keyMap.set(prevItems[i], [
          childNodes[i + offset],
          prevItems[i],
        ]);
      }
    }
    if (newLength === oldLength && keyMap.size > (newLength - start + 1) / 2) {
      const lastOrdered = childNodes[start + offset - 1];
      const set = [];
      for (let i = start; i <= newLength; i++) {
        set.push(keyMap.get(nextItems[i])?.[0] ?? childNodes[i + offset]);
      }
      lastOrdered.after(...set);
      prevItems = nextItems;
      keyMap.clear();
      return;
    }

    while (start <= newLength) {
      const newChd = nextItems[start];
      const oldChd = prevItems[start];
      if (newChd === oldChd) {
        start++;
        continue;
      }
      if (oldChd === undefined) {
        endBookend.before(render(newChd));
        start++;
        continue;
      }
      const mappedOld = keyMap.get(newChd);
      if (mappedOld) {
        const oldDom = childNodeList[start + offset];
        const [el, item] = mappedOld;
        if (oldDom !== el) {
          const tmp = el.nextSibling;
          parent.insertBefore(el, oldDom);
          parent.insertBefore(oldDom, tmp);
        } else if (item !== newChd) {
          replaceWith(newChd, el, render);
        }
        keyMap.delete(newChd);
      } else if (oldChd !== newChd) {
        parent.insertBefore(render(newChd), childNodeList[start + offset]);
      }
      start++;
    }
    for (const v of keyMap.values()) {
      teardownNode(v[0]);
      remove(v[0]);
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
