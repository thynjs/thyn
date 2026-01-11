import { collectEffect } from "./element.js";

let currentEffect: any;

type EffectTeardown = (() => void) | { delete: (v: any) => void };
type EffectFn = (() => (() => void) | void) & {
  mv?: boolean;
  dyn?: boolean;
  td: EffectTeardown | EffectTeardown[];
}

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
  subs: EffectFn | Set<EffectFn> | undefined;

  constructor(public value: T) { }

  get(): T {
    if (currentEffect) {
      const subs = this.subs;
      if (!subs) {
        this.subs = currentEffect;
        this._addTd(currentEffect);
      } else if (subs !== currentEffect) {
        if (typeof subs === 'function') {
          this.subs = new Set([subs, currentEffect]);
          this._addTd(currentEffect);
        } else if (!subs.has(currentEffect)) {
          subs.add(currentEffect);
          this._addTd(currentEffect);
        }
      }
    }
    return this.value;
  }

  _addTd(effect: EffectFn) {
    const td = effect.td;
    if (!td) {
      effect.td = this;
    } else if (Array.isArray(td)) {
      td.push(this);
    } else {
      effect.td = [td, this];
    }
  }

  delete(ef: EffectFn) {
    if (this.subs === ef) {
      this.subs = undefined;
    } else if (typeof this.subs !== 'function' && this.subs) {
      this.subs.delete(ef);
      if (this.subs.size === 0) this.subs = undefined;
    }
  }

  set(value: T): void {
    if (value !== this.value) {
      this.value = value;
      if (this.subs) {
        if (typeof this.subs === 'function') {
          scheduleEffect(this.subs);
        } else {
          this.subs.forEach(scheduleEffect);
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
  if (!ef.td) return;
  if (Array.isArray(ef.td)) {
    for (const f of ef.td) typeof f === "function" ? f() : f.delete(ef);
  } else {
    typeof ef.td === "function" ? ef.td() : ef.td.delete(ef);
  }
}
