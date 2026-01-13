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
          typeof ef === "function" ? ef() : ef.run();
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
  subs: any = undefined;

  constructor(public value: T) { }

  get(): T {
    if (currentEffect) {
      if (!this.subs) {
        this.subs = currentEffect;
      } else if (typeof this.subs === "function" || !this.subs.add) {
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
    } else if (typeof this.subs === "object" && this.subs.delete) {
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
        if (typeof this.subs === "function" || !this.subs.add) {
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
}

export function $signal<T>(value: T): SignalImpl<T> {
  return new SignalImpl(value);
}

function runEffectFn(ef: EffectFn) {
  const td = typeof ef === "function" ? ef() : ef.run();
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

class TextNodeEffect {
  next: any = undefined;
  td: any = undefined;
  constructor(public node: any, public signal: any) { }
  run() {
    this.node.data = this.signal.get();
  }
}

export function staticTextNodeEffect(node: any, signal: Signal<any>) {
  const ef = new TextNodeEffect(node, signal);
  const prev = currentEffect;
  currentEffect = ef;
  ef.run();
  currentEffect = prev;
  collectEffect(ef);
  return ef;
}
