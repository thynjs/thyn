import { currentEffects } from "./element";

let currentEffect = null;

let isBatching = false;
const pendingEffects = new Set<any>();

function scheduleEffect(effectFn) {
  pendingEffects.add(effectFn);
  if (!isBatching) {
    isBatching = true;
    queueMicrotask(() => {
      for (const ef of pendingEffects) ef.run();
      pendingEffects.clear();
      isBatching = false;
    });
  }
}

export function $state<T>(
  initialValue: T,
): [() => T, ((action: T | ((prev: T) => T)) => void)] {
  let value = initialValue;
  const subscribers = new Set<any>();
  return [
    () => {
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.deps.add(subscribers);
      }
      return value;
    },
    (action) => {
      const newValue = typeof action === "function"
        ? (action as Function)(value)
        : action;
      if (newValue !== value) {
        value = newValue;
        for (const sub of subscribers) {
          scheduleEffect(sub);
        }
      }
    },
  ];
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
 * const [selectedId, setSelectedId] = $state(null);
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
      currentEffect.teardown ??= [];
      currentEffect.teardown.push(() => {
        if (!subs.size) {
          map.delete(value);
        }
      });
    }
    return current === value;
  };
}

export function $effect(fn) {
  let ran = false;
  const runEffect = () => {
    if (ran) cleanup(effectFn);
    else ran = true;
    const prev = currentEffect;
    currentEffect = effectFn;
    const td = fn();
    if (td) {
      effectFn.teardown ??= [];
      effectFn.teardown.push(td);
    }
    currentEffect = prev;
  };
  const effectFn: {
    teardown?: (() => void)[];
    run: () => void;
    deps: Set<any>;
  } = {
    run: runEffect,
    deps: new Set(),
  };
  runEffect();
  currentEffects?.push(effectFn);
  return effectFn;
}

export function cleanup(effectFn) {
  for (const subs of effectFn.deps) {
    subs.delete(effectFn);
  }
  effectFn.deps.clear();
  if (effectFn.teardown) {
    for (const f of effectFn.teardown) f();
  }
}

export function $computed(fn) {
  const [result, setResult] = $state(undefined);
  $effect(() => setResult(fn()));
  return result;
}
