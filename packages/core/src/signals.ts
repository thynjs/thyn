import { collectEffect } from "./element.js";

let currentEffect: any;

let isBatching: boolean | undefined;
const pendingEffects: EffectFn[] = [];

function scheduleEffect(effectFn: EffectFn) {
  if (!effectFn.scheduled) {
    effectFn.scheduled = true;
    pendingEffects.push(effectFn);
    if (!isBatching) {
      isBatching = true;
      queueMicrotask(() => {
        for (const ef of pendingEffects) {
          ef.scheduled = false;
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
}

export type Signal<T> = {
  get(): T;
  set(value: T): void;
  update(updater: (prev: T) => T): void;
};

class SignalImpl<T> {
  subs: Set<EffectFn>;

  constructor(public value: T) {
    this.subs = new Set();
  }

  get(): T {
    if (currentEffect) {
      if (!this.subs.has(currentEffect)) {
        this.subs.add(currentEffect);
        currentEffect.td.push(this);
      }
    }
    return this.value;
  }

  delete(ef: EffectFn): void {
    this.subs.delete(ef);
  }

  set(value: T): void {
    if (value !== this.value) {
      this.value = value;
      for (const ef of this.subs) {
        scheduleEffect(ef);
      }
    }
  }

  update(action: (prev: T) => T): void {
    this.set(action(this.value));
  }
}

export function $signal<T>(value: T): SignalImpl<T> {
  return new SignalImpl(value);
}

function runEffectFn(ef: EffectFn) {
  const td = ef();
  if (td) {
    ef.td.push(td);
  }
}

type EffectTeardown = (() => void) | { delete: (v: any) => void };
type EffectFn = (() => (() => void) | void) & {
  mv?: boolean;
  dyn?: boolean;
  td: EffectTeardown[];
  scheduled?: boolean;
}

export function $effect(fn: (() => (() => void) | void) & any) {
  const prev = currentEffect;
  currentEffect = fn;
  fn.dyn = true;
  fn.td = [];
  runEffectFn(fn);
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function staticEffect(fn: (() => (() => void) | void) & any) {
  const prev = currentEffect;
  currentEffect = fn;
  fn.td = [];
  fn();
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function cleanup(ef: EffectFn) {
  if (ef.td) {
    for (const f of ef.td) {
      if (typeof f === "function") {
        f();
      } else {
        f.delete(ef);
      }
    }
    ef.td.length = 0;
  }
}
