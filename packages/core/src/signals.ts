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
  const subs = new Set<any>();

  return (...args: [T] | [(prev: T) => T] | []) => {
    if (!args.length) {
      if (currentEffect) {
        subs.add(currentEffect);
        currentEffect.td.push(subs);
      }
      return value;
    }

    const action = args[0];
    const newValue = typeof action === "function"
      ? (action as (prev: T) => T)(value)
      : action;

    if (newValue !== value) {
      value = newValue;
      for (const sub of subs) {
        scheduleEffect(sub);
      }
    }
  };
}

class CompareSet {
  constructor(private m, private k, private s = new Set<EffectFn>()) { }
  
  add(fn: EffectFn) {
    this.s.add(fn);
  }
  
  delete(fn: EffectFn) {
    this.s.delete(fn);
    if (!this.s.size) {
      this.m.delete(this.k);
    }
  }

  run() {
    for (const sub of this.s) scheduleEffect(sub);
  }
}

export function $compare<T>(fn: () => T): (value: T) => boolean {
  const map = new Map<T, CompareSet>();
  let current: T = fn();

  staticEffect(() => {
    const newValue = fn();
    if (newValue === current) return;
    map.get(current)?.run();
    map.get(newValue)?.run();
    current = newValue;
  });

  return (value: T) => {
    if (currentEffect) {
      let subs = map.get(value);
      if (!subs) map.set(value, subs = new CompareSet(map, value));
      subs.add(currentEffect);
      currentEffect.td.push(subs);
    }
    return current === value;
  };
}

function runEffectFn(ef: EffectFn) {
  const td = ef();
  if (td) {
    ef.td.push(td);
  }
}

type EffectFn = (() => (() => void) | void) & {
  mv?: boolean;
  dyn?: boolean;
  td: ((() => void) | { delete: (v: any) => void })[];
}

export function $effect(fn: (() => (() => void) | void) & any) {
  fn.td = [];
  const prev = currentEffect;
  currentEffect = fn;
  fn.dyn = true;
  runEffectFn(fn);
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function staticEffect(fn: (() => (() => void) | void) & any) {
  fn.td = [];
  const prev = currentEffect;
  currentEffect = fn;
  fn();
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function cleanup(ef: EffectFn) {
  for (const f of ef.td) typeof f === "function" ? f() : f.delete(ef);
}
