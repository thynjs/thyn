export type Signal<T> = {
  get(): T;
  set(value: T): void;
  update(updater: (prev: T) => T): void;
};

let currentEffect: any;

function runEffect(ef: any) {
  if (ef.dyn) {
    cleanup(ef);
    if (ef.td) ef.td.length = 0;
    else ef.td = [];
    const prev = currentEffect;
    currentEffect = ef;
    runEffectFn(ef);
    currentEffect = prev;
  } else {
    ef();
  }
}

class SignalImpl<T> {
  subs: Set<any> | undefined = undefined;

  constructor(public value: T) { }

  get(): T {
    if (currentEffect) {
      if (!this.subs) {
        this.subs = new Set();
        this.subs.add(currentEffect);
      } else {
        this.subs.add(currentEffect);
      }
      if (!currentEffect.td) {
        currentEffect.td = [this];
      } else {
        currentEffect.td.push(this);
      }
    }
    return this.value;
  }

  delete(ef: any): void {
    if (this.subs) {
      this.subs.delete(ef);
      if (this.subs.size === 0) {
        this.subs = undefined;
      }
    }
  }

  set(value: T): void {
    if (value !== this.value) {
      this.value = value;
      if (this.subs) {
        for (const ef of Array.from(this.subs)) {
          runEffect(ef);
        }
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
    if (ef.td) {
      ef.td.push(td);
    } else {
      ef.td = [td];
    }
  }
}

type EffectTeardown = (() => void) | { delete: (v: any) => void };
type EffectFn = (() => (() => void) | void) & {
  mv?: boolean;
  dyn?: boolean;
  td: EffectTeardown[]; // Always Array
}

export function $effect(fn: (() => (() => void) | void) & any) {
  const prev = currentEffect;
  currentEffect = fn;
  fn.dyn = true;
  runEffectFn(fn);
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function staticEffect(fn: (() => (() => void) | void) & any) {
  const prev = currentEffect;
  currentEffect = fn;
  fn();
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function cleanup(ef: any) {
  if (!ef.td) return;
  for (const f of ef.td) {
    if (typeof f === "function") {
      f();
    } else {
      f.delete(ef);
    }
  }
}

import { collectEffect } from "./element.js";
