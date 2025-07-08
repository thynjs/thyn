import { $effect, cleanup } from "./signals.js";

export function mount(app, parent) {
  parent.appendChild(app());
}

export let currentEffects: any | undefined;

export function createReactiveTextNode(v) {
  let n;
  $effect(() => {
    if (n) {
      n.nodeValue = v();
    } else {
      n = document.createTextNode(v());
    }
  }, true);
  return n;
}

export function component(name, props?: any) {
  const prevEffects = currentEffects;
  currentEffects = [];
  const e = name(props);
  const existing = e.$fx;
  if (existing) {
    if (existing.some(f => f.mv)) {
      for (const f of currentEffects) {
        f.mv = true;
      }
    }
    existing.push(...currentEffects);
  } else {
    e.$fx = currentEffects;
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
    }, true),
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
    }, true),
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
  if (!el.$fx) el.$fx = [];
  return el;
}

export function addEffect(el, ef) {
  if (el.$fx) {
    el.$fx.push(ef);
  } else {
    el.$fx = [ef];
  }
  return el;
}

function shallowTeardown(elem) {
  for (const eff of elem.$fx) {
    cleanup(eff);
  }
}

function teardown(elem, iterating = false) {
  if (elem.$frag) {
    var start = elem;
    var end = elem.$end;
    elem = elem.$frag;
  }
  if (elem.$fx) {
    shallowTeardown(elem);
    if (end) {
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
  if (elem.$end) {
    const end = elem.$end;
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
  let prevElem: (Element | Comment) & { $fx?: any[] };

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
      const prevFx = prevElem.$fx;
      let sticky = [];
      if (prevFx) {
        sticky = prevFx.filter(f => f.mv);
        prevElem.$fx = prevFx.filter(f => !f.mv);
      }
      const fx = newElem.$fx;
      if (fx) {
        fx.push(...sticky);
      } else {
        newElem.$fx = sticky;
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
  }, false, true);

  return prevElem;
}

const replaceWith = (nextItem, prevElement, render) => {
  teardown(prevElement);
  prevElement.replaceWith(render(nextItem));
};

export function terminalList(props) {
  return list(props, true);
}

export function list(props, terminal = false) {
  const teardownNode = terminal ? (e: any) => e.$fx && shallowTeardown(e) : teardown;
  let parent;
  let outlet = document.createDocumentFragment();
  let prevItems;
  const startBookend = document.createComment("") as any;
  const endBookend = document.createComment("") as any;
  startBookend.$frag = outlet;
  startBookend.$end = endBookend;
  const render = props.render;
  let isolated;

  $effect(() => {
    parent = startBookend.parentNode;
    if (!parent) {
      prevItems = props.items();
      outlet.appendChild(startBookend);
      for (const i of prevItems) {
        outlet.appendChild(render(i));
      }
      outlet.appendChild(endBookend);
      return;
    }
    let nextItems = props.items();
    let newLength = nextItems.length;
    let oldLength = prevItems.length;
    if (!oldLength && newLength) {
      endBookend.before(...nextItems.map(render))
      prevItems = nextItems;
      nextItems = null;
      return;
    }
    const childNodeList = parent.childNodes as NodeListOf<ChildNode>;
    isolated = !startBookend.previousSibling && !endBookend.nextSibling;
    if (!newLength) {
      const end = childNodeList.length - 1;
      if (isolated) {
        for (let i = 1; i < end; i++) {
          teardownNode(childNodeList[i]);
        }
        parent.textContent = "";
        parent.appendChild(startBookend);
        parent.appendChild(endBookend);
      } else {
        const removalQueue = [];
        for (let i = 1; i < end; i++) {
          const ch = childNodeList[i];
          teardownNode(ch);
          removalQueue.push(ch);
        }
        for (const ch of removalQueue) {
          remove(ch);
        }
      }
      prevItems = nextItems;
      nextItems = null;
      return;
    }

    let start = nextItems.findIndex((item, index) => prevItems[index] !== item);
    if (start === oldLength) {
      endBookend.before(...nextItems.slice(start).map(render));
      prevItems = nextItems;
      nextItems = null;
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
      nextItems = null;
      return;
    }

    if (start >= newLength) {
      while (start < oldLength) {
        const e = childNodes[offset + --oldLength];
        teardownNode(e);
        remove(e);
      }
      prevItems = nextItems;
      nextItems = null;
      return;
    }

    // suffix
    for (
      oldLength--, newLength--;
      newLength > start &&
      oldLength >= start &&
      nextItems[newLength] === prevItems[oldLength];
      oldLength--, newLength--
    );

    const nextKeys = new Set(nextItems);
    const removalQueue = [];
    for (let i = start; i <= oldLength; i++) {
      if (!nextKeys.has(prevItems[i])) {
        const ch = childNodes[i + offset];
        teardownNode(ch);
        removalQueue.push(ch);
        childNodes[i + offset] = null;
      }
    }
    if (isolated && removalQueue.length === prevItems.length) {
      parent.textContent = "";
      parent.append(startBookend, ...nextItems.map(render), endBookend);
      prevItems = nextItems;
      nextItems = null;
      return;
    }
    for (const e of removalQueue) {
      remove(e);
    }
    let keyMap = new Map();
    for (let i = start; i <= oldLength; i++) {
      if (
        childNodes[i + offset] &&
        (!nextItems[i] ||
          prevItems[i] !== nextItems[i])
      ) {
        keyMap.set(prevItems[i], {
          el: childNodes[i + offset],
          item: prevItems[i],
        });
      }
    }
    if (newLength === oldLength && keyMap.size > (newLength - start + 1) / 2) {
      const lastOrdered = childNodes[start + offset - 1];
      const set = [];
      for (let i = start; i <= newLength; i++) {
        set.push(keyMap.get(nextItems[i])?.el ?? childNodes[i + offset]);
      }
      lastOrdered.after(...set);
      prevItems = nextItems;
      keyMap = null;
      nextItems = null;
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
        parent.insertBefore(render(newChd), endBookend);
        start++;
        continue;
      }
      const mappedOld = keyMap.get(newChd);
      if (mappedOld) {
        const oldDom = childNodeList[start + offset];
        const { el, item } = mappedOld;
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
    for (const { el } of keyMap.values()) {
      teardownNode(el);
      remove(el);
    }
    keyMap = null;
    prevItems = nextItems;
    nextItems = null;
  }, true);
  return outlet;
}
