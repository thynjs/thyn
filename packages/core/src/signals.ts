import { collectEffect } from "./element.js";

let currentEffect: any;

let isBatching: boolean | undefined;
const pendingEffects: EffectFn[] = [];

function scheduleEffect(effectFn: EffectFn) {
  pendingEffects.push(effectFn);
  if (!isBatching) {
    isBatching = true;
    queueMicrotask(() => {
      for (const ef of pendingEffects) {
        if (ef.dyn) {
          cleanup(ef);
          ef.td = [];
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
  get(): T;
  set(value: T): void;
  update(updater: (prev: T) => T): void;
};

class SignalImpl<T> {
  subs: Set<any> = new Set();

  constructor(public value: T) { }

  get(): T {
    if (currentEffect) {
      this.subs.add(currentEffect);
      currentEffect.td.push(this);
    }
    return this.value;
  }

  delete(ef: any): void {
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
  for (const f of ef.td) typeof f === "function" ? f() : f.delete(ef);
}
