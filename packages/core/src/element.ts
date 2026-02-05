import { $effect, cleanup, staticEffect, uncollectedStaticEffect } from "./signals.js";

const MAX_SAFE_SPREAD = 10000;

export function mount(app, parent) {
  parent.appendChild(app());
}

let collectingHead;

export function collectEffect(effectFn) {
  if (collectingHead) {
    effectFn.next = collectingHead;
  }
  collectingHead = effectFn;
}

export function createReactiveTextNode(v) {
  let n;
  staticEffect(() => {
    if (n) {
      n.nodeValue = v();
    } else {
      n = document.createTextNode(v());
    }
  });
  return n;
}

export function component(name, props?: any) {
  const prevHead = collectingHead;
  collectingHead = null;
  const e = name(props);
  const existing = e.$fx;

  if (existing) {
    let current = existing;
    while (current) {
      if (current.mv) {
        let curr = collectingHead;
        while (curr) {
          curr.mv = true;
          curr = curr.next;
        }
        break;
      }
      current = current.next;
    }
    if (collectingHead) {
      let tail = existing;
      while (tail.next) {
        tail = tail.next;
      }
      tail.next = collectingHead;
    }
  } else {
    e.$fx = collectingHead;
  }

  collectingHead = prevHead;
  return e;
}

export function fixedComponent(name, props?: any) {
  const prevHead = collectingHead;
  collectingHead = null;
  const e = name(props);
  e.$fx = collectingHead;
  collectingHead = prevHead;
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
  return addEffect(
    el,
    uncollectedStaticEffect(() => {
      const v = val();
      if (ran) {
        if (v === undefined) el.removeAttribute(key);
        else el.setAttribute(key, v);
        return;
      }
      if (v !== undefined) el.setAttribute(key, v);
      ran = true;
    }),
  );
}
export function setReactiveProperty(el, key, val) {
  let ran;
  return addEffect(
    el,
    uncollectedStaticEffect(() => {
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
}

export function addChildren(e, children) {
  for (const ch of children) {
    e.appendChild(ch);
  }
  return e;
}

export function markAsReactive(el) {
  if (!el.$fx) el.$fx = null;
  return el;
}

export function addEffect(el, ef) {
  if (!ef.td) return el;
  if (el.$fx) {
    ef.next = el.$fx;
    el.$fx = ef;
  } else {
    el.$fx = ef;
  }
  return el;
}

function shallowTeardown(elem) {
  let current = elem.$fx;
  if (!current) return;
  elem.$fx = undefined;
  while (current) {
    const next = current.next;
    cleanup(current);
    current.td = null;
    current.next = undefined;
    current = next;
  }
}

function teardown(elem, iterating = false) {
  if (elem.$frag) {
    var start = elem;
    var end = elem.$end;
    elem = elem.$frag;
  }
  if (elem.$fx !== undefined) {
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

// Helper function to filter linked list
function filterEffects(head, predicate) {
  let current = head;
  let filtered = null;
  let filteredTail = null;

  while (current) {
    if (predicate(current)) {
      if (!filtered) {
        filtered = current;
        filteredTail = current;
      } else {
        filteredTail.next = current;
        filteredTail = current;
      }
    }
    current = current.next;
  }

  if (filteredTail) {
    filteredTail.next = null;
  }

  return filtered;
}

export function show(props) {
  let prevIndex = -1;
  let prevElem: (Element | Comment) & { $fx?: any };

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
      const prevFx = prevElem.$fx;
      let sticky = null;
      if (prevFx) {
        sticky = filterEffects(prevFx, f => f.mv);
        prevElem.$fx = filterEffects(prevFx, f => !f.mv);
      }

      if (sticky) {
        // Find tail of sticky effects
        let stickyTail = sticky;
        while (stickyTail.next) {
          stickyTail = stickyTail.next;
        }

        // Append to new element's effects
        if (newElem.$fx) {
          stickyTail.next = newElem.$fx;
          newElem.$fx = sticky;
        } else {
          newElem.$fx = sticky;
        }
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
  eff.mv = true;
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
  const teardownNode = terminal ? shallowTeardown : teardown;
  let parent;
  let outlet = document.createDocumentFragment();
  let prevItems;
  const startBookend = document.createComment("") as any;
  const endBookend = document.createComment("") as any;
  startBookend.$frag = outlet;
  startBookend.$end = endBookend;
  const render = props.render;

  staticEffect(() => {
    parent = startBookend.parentNode;
    if (!parent) {
      prevItems = props.items();
      outlet.append(startBookend, ...prevItems.map(render), endBookend);
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
    const childNodes = Array.from(childNodeList);
    const offset = childNodes.indexOf(startBookend) + 1;
    if (!newLength) {
      const removalQueue = [];
      const end = prevItems.length + offset;
      for (let i = offset; i < end; i++) {
        const ch = childNodeList[i];
        teardownNode(ch);
        removalQueue.push(ch);
      }
      for (const ch of removalQueue) {
        remove(ch);
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
    for (const e of removalQueue) {
      remove(e);
    }
    if (oldLength - start === removalQueue.length) {
      prevItems = nextItems;
      nextItems = null;
      return;
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
  });
  return outlet;
}

export function isolatedTerminalList(props) {
  let parent;
  let outlet = document.createDocumentFragment();
  let prevItems;
  const startBookend = document.createComment("") as any;
  const endBookend = document.createComment("") as any;
  startBookend.$frag = outlet;
  startBookend.$end = endBookend;
  const render = props.render;

  staticEffect(() => {
    parent = startBookend.parentNode;
    if (!parent) {
      prevItems = props.items();
      if (prevItems.length <= MAX_SAFE_SPREAD) {
        outlet.append(startBookend, ...prevItems.map(render), endBookend);
      } else {
        outlet.appendChild(startBookend);
        for (const item of prevItems) {
          outlet.appendChild(render(item));
        }
        outlet.appendChild(endBookend);
      }
      return;
    }
    let nextItems = props.items();
    let newLength = nextItems.length;
    let oldLength = prevItems.length;
    if (!oldLength && newLength) {
      if (newLength <= MAX_SAFE_SPREAD) {
        endBookend.before(...nextItems.map(render))
      } else {
        for (const item of nextItems) {
          parent.insertBefore(render(item), endBookend);
        }
      }
      prevItems = nextItems;
      nextItems = null;
      return;
    }
    const childNodeList = parent.childNodes as NodeListOf<ChildNode>;
    if (!newLength) {
      let node = startBookend.nextSibling
      while (node !== endBookend) {
        shallowTeardown(node);
        node = node.nextSibling;
      }
      parent.textContent = "";
      parent.append(startBookend, endBookend);
      prevItems = nextItems;
      nextItems = null;
      return;
    }

    let start = nextItems.findIndex((item, index) => prevItems[index] !== item);
    if (start === oldLength) { // append items
      if (newLength <= MAX_SAFE_SPREAD) {
        endBookend.before(...nextItems.slice(start).map(render));
      } else {
        for (let i = start; i < newLength; i++) {
          parent.insertBefore(render(nextItems[i]), endBookend);
        }
      }
      prevItems = nextItems;
      nextItems = null;
      return;
    }

    if (start < 0) { // truncation
      let removeCount = oldLength - newLength;
      while (removeCount-- > 0) {
        const node = endBookend.previousSibling;
        shallowTeardown(node);
        node.remove();
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
    const removalQueueIndices = [];
    for (let i = start; i <= oldLength; i++) {
      if (!nextKeys.has(prevItems[i])) {
        removalQueueIndices.push(i + 1);
      }
    }
    if (removalQueueIndices.length === prevItems.length) { // replace all
      let node = startBookend.nextSibling;
      while (node !== endBookend) {
        shallowTeardown(node);
        node = node.nextSibling;
      }
      parent.textContent = "";
      if (nextItems.length <= MAX_SAFE_SPREAD) {
        parent.append(startBookend, ...nextItems.map(render), endBookend);
      } else {
        parent.appendChild(startBookend);
        for (const item of nextItems) {
          parent.appendChild(render(item));
        }
        parent.appendChild(endBookend);
      }
      prevItems = nextItems;
      nextItems = null;
      return;
    }
    let childNodes = Array.from(childNodeList);
    for (const i of removalQueueIndices) {
      const ch = childNodes[i];
      shallowTeardown(ch);
      ch.remove();
      childNodes[i] = null;
    }
    if (oldLength - start === removalQueueIndices.length) {
      prevItems = nextItems;
      nextItems = null;
      childNodes = null;
      return;
    }
    let keyMap = new Map();
    for (let i = start; i <= oldLength; i++) {
      if (
        childNodes[i + 1] &&
        (!nextItems[i] ||
          prevItems[i] !== nextItems[i])
      ) {
        keyMap.set(prevItems[i], {
          el: childNodes[i + 1],
          item: prevItems[i],
        });
      }
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
        const oldDom = childNodeList[start + 1];
        const { el, item } = mappedOld;
        if (oldDom !== el) {
          const tmp = el.nextSibling;
          parent.insertBefore(el, oldDom);
          if (oldDom !== tmp) {
            parent.insertBefore(oldDom, tmp);
          }
        } else if (item !== newChd) {
          replaceWith(newChd, el, render);
        }
        keyMap.delete(newChd);
      } else if (oldChd !== newChd) {
        parent.insertBefore(render(newChd), childNodeList[start + 1]);
      }
      start++;
    }
    for (const { el } of keyMap.values()) {
      shallowTeardown(el);
      el.remove();
    }
    keyMap = null;
    prevItems = nextItems;
    nextItems = null;
    childNodes = null;
  });
  return outlet;
}
