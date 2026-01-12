const delegatedEvents = new Set<string>();
const nonDelegated = new Set(['mouseenter', 'mouseleave', 'focus', 'blur', 'load', 'unload', 'scroll', 'resize']);

const handleEvent = (e: Event) => {
  let node = e.target as Node | null;
  const eventName = e.type;

  while (node && node !== document) {
    const handler = (node as any).__thyn_events?.[eventName];
    if (handler) {
      handler(e);
      if (e.cancelBubble) return;
    }
    node = node.parentNode;
  }
};

export function addEvent(el: any, event: string, handler: any) {
  if (nonDelegated.has(event)) {
    if (!el.__thyn_direct_events) el.__thyn_direct_events = {};

    if (el.__thyn_direct_events[event]) {
        el.removeEventListener(event, el.__thyn_direct_events[event]);
        delete el.__thyn_direct_events[event];
    }

    if (handler) {
        el.addEventListener(event, handler);
        el.__thyn_direct_events[event] = handler;
    }
    return;
  }

  if (!delegatedEvents.has(event)) {
    delegatedEvents.add(event);
    document.addEventListener(event, handleEvent);
  }

  if (!el.__thyn_events) {
    el.__thyn_events = {};
  }

  if (handler) {
    el.__thyn_events[event] = handler;
  } else {
    delete el.__thyn_events[event];
  }
}
