import { currentEffects } from "./element.js";

let currentEffect: any;

let isBatching: boolean | undefined;
const pendingEffects = [];

function scheduleEffect(effectFn: EffectFn) {
  pendingEffects.push(effectFn);
  if (!isBatching) {
    isBatching = true;
    queueMicrotask(() => {
      for (const ef of pendingEffects) runEffect(ef);
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
        currentEffect.deps.add(subscribers);
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

/**
 * Creates a reactive equality checker function based on a reactive source.
 *
 * This is useful when you want to conditionally react to equality against a selected value,
 * such as highlighting a selected item in a list. Only effects that call the returned function
 * with the **current** value will re-run when the source value changes.
 *
 * Example:
 *
 * ```ts
 * const selectedId  = $signal(null);
 * const isSelected = $compare(selectedId);
 *
 * $effect(() => {
 *   if (isSelected(row.id)) {
 *     // React only if row.id === selectedId()
 *   }
 * });
 * ```
 *
 * Internally, only effects that compare against the current or previous selected value
 * are re-evaluated when the source changes. This is especially efficient in large lists.
 *
 * @template T The type of the reactive value being compared.
 * @param {() => T} fn A reactive function returning the current value to compare against.
 * @returns {(value: T) => boolean} A function that returns true if the provided value
 * matches the current value from `fn()`. Automatically subscribes the calling effect
 * to changes in that specific value.
 */
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
  });

  return (value: T) => {
    if (currentEffect) {
      let subs = map.get(value);
      if (!subs) map.set(value, subs = new Set());
      subs.add(currentEffect);
      currentEffect.deps.add(subs);

      const teardownFn = () => {
        subs.delete(currentEffect);
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

function runEffect(effectFn: EffectFn, skip?: boolean) {
  if (!skip) {
    cleanup(effectFn);
  }
  const prev = currentEffect;
  currentEffect = effectFn;
  const td = effectFn.run();
  if (td) {
    if (effectFn.td) {
      effectFn.td.push(td);
    } else {
      effectFn.td = [td];
    }
  }
  currentEffect = prev;
}

interface EffectFn {
  run: () => (() => void) | void;
  deps: Set<any>;
  show?: boolean;
  td?: (() => void)[];
}

export function $effect(fn: EffectFn["run"], show?: boolean) {
  const effectFn: EffectFn = {
    run: fn,
    deps: new Set(),
  };
  if (show) effectFn.show = true;
  runEffect(effectFn, true);
  if (currentEffects) currentEffects.push(effectFn);
  return effectFn;
}

export function cleanup(effectFn: EffectFn) {
  const { deps, td } = effectFn;
  for (const subs of deps) {
    subs.delete(effectFn);
  }
  deps.clear();
  if (td) for (const f of td) f();
}
