const delegatedEvents = new Set<string>();

const eventMap: Record<string, string> = {
  focus: 'focusin',
  blur: 'focusout',
};

// Events that bubble and are safe to delegate
const bubbly = new Set([
  'click', 'dblclick', 'contextmenu',
  'keydown', 'keypress', 'keyup',
  'mousedown', 'mousemove', 'mouseup', 'mouseout', 'mouseover',
  'touchstart', 'touchend', 'touchmove', 'touchcancel',
  'change', 'input', 'submit', 'reset',
  'focusin', 'focusout',
  'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'dragstart', 'drop',
  'animationstart', 'animationend', 'animationiteration',
  'transitionend'
]);

export function addEvent(el: any, name: string, handler: Function) {
  let eventName = name.startsWith('on') ? name.slice(2).toLowerCase() : name.toLowerCase();

  // Map events if needed (e.g. focus -> focusin)
  if (eventName in eventMap) {
    eventName = eventMap[eventName];
  }

  // If it's a known bubbling event, delegate it
  if (bubbly.has(eventName)) {
    if (!delegatedEvents.has(eventName)) {
      delegatedEvents.add(eventName);
      document.addEventListener(eventName, handleEvent);
    }
    if (!el.$$events) el.$$events = {};
    el.$$events[eventName] = handler;
  } else {
    // Fallback for non-bubbling events (scroll, load, mouseenter, etc.)
    // We attach directly.
    el.addEventListener(eventName, handler);
  }
}

function handleEvent(e: Event) {
  let node = e.target as Node;
  const eventName = e.type;

  while (node) {
    const handler = (node as any).$$events?.[eventName];
    if (handler) {
      // Use .call to set 'this' to the element, mimicking currentTarget
      handler.call(node, e);
      if (e.cancelBubble) return;
    }
    if (node === document) break;
    node = node.parentNode;
  }
}
