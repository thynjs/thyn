import { component, show } from "./element.js";
import { $signal, staticEffect } from "./signals.js";

const params = $signal({} as any);

export const router = {
  path: $signal(location.pathname),
  param: (name: string): string | undefined => params()[name],
};


interface Route {
  path: string;
  component: () => Node;
}

export function Router({ routes }: { routes: Route[] }) {
  const current = $signal(null);
  const compiledRoutes = routes.map(route => {
    const compiledRoute = {
      path: null,
      raw: route,
      names: [],
      component: route.component,
    };
    compiledRoute.path = new RegExp(`^${route.path.replace(/\/:([^/]+)/g, (_, name) => {
      compiledRoute.names.push(name);
      return '/([^/]+)';
    })}$`);
    return compiledRoute;
  });

  staticEffect(() => {
    const pn = router.path();
    if (pn !== location.pathname) {
      history.pushState({}, "", pn);
    }
    const ps = {};
    let rt = null;
    for (const route of compiledRoutes) {
      const match = pn.match(route.path);
      if (!match) continue;
      for (let i = 0; i < route.names.length; i++) {
        const name = route.names[i];
        ps[name] = decodeURIComponent(match[i + 1]);
      }
      rt = route;
      break;
    };
    current(rt);
    params(ps);
  });

  return component(
    show,
    compiledRoutes.map((r) => ({
      if: () => r === current(),
      then: () => component(r.component),
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
      router.path(to);
    }
  };
  return a;
}
