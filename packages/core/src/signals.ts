import { collectEffect } from "./element.js";

let currentEffect: any;

let isBatching: boolean | undefined;
const pendingEffects = [];

function scheduleEffect(effectFn: EffectFn) {
  pendingEffects.push(effectFn);
  if (!isBatching) {
    isBatching = true;
    queueMicrotask(() => {
      for (const ef of pendingEffects) {
        if (ef.dyn) {
          cleanup(ef);
          const prev = currentEffect;
          currentEffect = ef;
          runEffectFn(ef);
          currentEffect = prev;
        } else {
          ef();
        }
      }
      pendingEffects.length = 0;
      isBatching = false;
    });
  }
}

export type Signal<T> = {
  (): T;
  (value: T): void;
  (updater: (prev: T) => T): void;
};

export function $signal<T>(value: T): Signal<T> {
  const subscribers = new Set<any>();

  return (...args: [T] | [(prev: T) => T] | []) => {
    if (!args.length) {
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.deps.push(subscribers);
      }
      return value;
    }

    const action = args[0];
    const newValue = typeof action === "function"
      ? (action as (prev: T) => T)(value)
      : action;

    if (newValue !== value) {
      value = newValue;
      for (const sub of subscribers) {
        scheduleEffect(sub);
      }
    }
  };
}

export function $compare<T>(fn: () => T): (value: T) => boolean {
  const map = new Map<T, Set<any>>();
  let current: T = fn();

  $effect(() => {
    const newValue = fn();
    if (newValue === current) return;

    const prevSubs = map.get(current);
    const nextSubs = map.get(newValue);

    current = newValue;

    // Only notify subscribers for new and old values
    if (prevSubs) {
      for (const sub of prevSubs) scheduleEffect(sub);
    }
    if (nextSubs) {
      for (const sub of nextSubs) scheduleEffect(sub);
    }
  }, true);

  return (value: T) => {
    if (currentEffect) {
      let subs = map.get(value);
      if (!subs) map.set(value, subs = new Set());
      subs.add(currentEffect);
      const f = currentEffect;
      const teardownFn = () => {
        subs.delete(f);
        if (subs.size === 0) {
          map.delete(value);
        }
      };

      if (currentEffect.td) {
        currentEffect.td.push(teardownFn);
      } else {
        currentEffect.td = [teardownFn];
      }
    }
    return current === value;
  };
}

function runEffectFn(effectFn: EffectFn) {
  const td = effectFn();
  if (td) {
    if (effectFn.td) {
      effectFn.td.push(td);
    } else {
      effectFn.td = [td];
    }
  }
}

type EffectFn = (() => (() => void) | void) & {
  deps: any[];
  mv?: boolean;
  dyn?: boolean;
  td?: (() => void)[];
}

export function $effect(fn: (() => (() => void) | void) & any, stat?: boolean, mv?: boolean) {
  fn.deps = [];
  if (mv) fn.mv = true;
  const prev = currentEffect;
  currentEffect = fn;
  if (stat) {
    fn();
  } else {
    fn.dyn = true;
    runEffectFn(fn);
  }
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function cleanup(effectFn: EffectFn) {
  for (const subs of effectFn.deps) {
    subs.delete(effectFn);
  }
  effectFn.deps.length = 0;
  if (effectFn.td) for (const f of effectFn.td) f();
}
