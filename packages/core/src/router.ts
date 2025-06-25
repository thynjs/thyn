import { component, show } from "./element.js";
import { $signal } from "./signals.js";

export const pathname = $signal(location.pathname);

export function Router({ routes }) {
  return component(
    show,
    routes.map((r) => ({
      if: () => r.path === pathname(),
      then: r.component,
    })),
  );
}

export function Link({ slot, to }) {
  const a = document.createElement("a");
  a.href = to;

  for (const ch of slot) {
    a.appendChild(ch);
  }

  a.onclick = (e) => {
    if (
      !e.defaultPrevented &&
      e.button === 0 &&
      !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    ) {
      e.preventDefault();
      history.pushState({}, "", to);
      pathname(to);
    }
  };

  return a;
}
