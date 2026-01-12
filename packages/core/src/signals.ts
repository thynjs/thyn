import { collectEffect } from "./element.js";

let currentEffect: any;

let isBatching: boolean | undefined;
const pendingEffects = new Set<EffectFn>();

function scheduleEffect(effectFn: EffectFn) {
  if (pendingEffects.has(effectFn)) return;
  pendingEffects.add(effectFn);
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
      pendingEffects.clear();
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
  subs: any = undefined;

  constructor(public value: T) { }

  get(): T {
    if (currentEffect) {
      if (!this.subs) {
        this.subs = currentEffect;
      } else if (typeof this.subs === "function") {
        if (this.subs !== currentEffect) {
          const oldEffect = this.subs;
          this.subs = new Set();
          this.subs.add(oldEffect);
          this.subs.add(currentEffect);
        }
      } else {
        this.subs.add(currentEffect);
      }
      if (!currentEffect.td) {
        currentEffect.td = this;
      } else if (Array.isArray(currentEffect.td)) {
        currentEffect.td.push(this);
      } else {
        currentEffect.td = [currentEffect.td, this];
      }
    }
    return this.value;
  }

  delete(ef: any): void {
    if (this.subs === ef) {
      this.subs = undefined;
    } else if (typeof this.subs === "object") {
      this.subs.delete(ef);
      if (this.subs.size === 0) {
        this.subs = undefined;
      } else if (this.subs.size === 1) {
        this.subs = this.subs.values().next().value;
      }
    }
  }

  set(value: T): void {
    if (value !== this.value) {
      this.value = value;
      if (this.subs) {
        if (typeof this.subs === "function") {
          scheduleEffect(this.subs);
        } else {
          for (const ef of this.subs) {
            scheduleEffect(ef);
          }
        }
      }
    }
  }

  update(action: (prev: T) => T): void {
    this.set(action(this.value));
  }

  subscribe(fn: (val: T) => void) {
    const node: any = () => fn(this.value);
    node.td = this;
    if (!this.subs) {
      this.subs = node;
    } else if (typeof this.subs === "function") {
      const oldEffect = this.subs;
      this.subs = new Set();
      this.subs.add(oldEffect);
      this.subs.add(node);
    } else {
      this.subs.add(node);
    }
    node();
    return node;
  }
}

export function $signal<T>(value: T): SignalImpl<T> {
  return new SignalImpl(value);
}

function runEffectFn(ef: EffectFn) {
  const td = ef();
  if (td) {
    if (ef.td) {
      if (Array.isArray(ef.td)) {
        ef.td.push(td)
      } else {
        ef.td = [ef.td, td];
      }
    } else {
      ef.td = td;
    }
  }
}

type EffectTeardown = (() => void) | { delete: (v: any) => void };
type EffectFn = (() => (() => void) | void) & {
  mv?: boolean;
  dyn?: boolean;
  td: EffectTeardown | EffectTeardown[];
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

export function cleanup(ef) {
  if (typeof ef.td === "function") {
    ef.td();
  } else if (ef.td.delete) {
    ef.td.delete(ef);
  } else {
    for (const f of ef.td) typeof f === "function" ? f() : f.delete(ef);
  }
}
