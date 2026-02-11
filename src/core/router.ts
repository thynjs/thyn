import { component, show } from "./element.js";
import { $signal, staticEffect } from "./signals.js";

let params = null;
let routerPath = null;
let initialized = false;

function initRouter() {
  if (initialized) return;
  params = $signal({} as any);
  routerPath = $signal(location.pathname);
  initialized = true;
}

export const router = {
  get path() {
    initRouter();
    return routerPath;
  },
  param: (name: string): string | undefined => {
    initRouter();
    return params()[name];
  },
};

interface Route {
  path: string;
  component: () => Node;
}

export function Router({ routes }: { routes: Route[] }) {
  initRouter();
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
    const pn = routerPath();
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
  initRouter();
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
      routerPath(to);
    }
  };
  return a;
}
