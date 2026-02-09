import { collectEffect } from "./element.js";

let currentEffect: any;

let isBatching: boolean | undefined;
const pendingEffects = [];

function runEffects() {
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
}

function scheduleEffect(effectFn: EffectFn) {
  pendingEffects.push(effectFn);
  if (!isBatching) {
    isBatching = true;
    queueMicrotask(runEffects);
  }
}

// 1. Define the Overloaded Interface for the Signal function
export interface Signal<T> {
  (): T;                                   // Getter
  (newValue: T): void;                     // Setter
  (updater: (prev: T) => T): void;         // Updater
}

const SENTINEL = Symbol();

export function $signal<T>(initialValue: T): Signal<T> {
  const s = (newValue: any = SENTINEL) => {
    if (newValue === SENTINEL) {
      if (currentEffect) {
        s.subs.add(currentEffect);
        const td = currentEffect.td;
        currentEffect.td = !td ? s.subs : (Array.isArray(td) ? (td.push(s.subs), td) : [td, s.subs]);
      }
      return s.value;
    }
    if (typeof newValue === "function") newValue = newValue(s.value);
    if (newValue !== s.value) {
      s.value = newValue;
      s.subs.forEach(scheduleEffect);
    }
  };
  s.value = initialValue;
  s.subs = new Set();
  return s as unknown as Signal<T>;
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
  fn.td = null;
  fn();
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function uncollectedStaticEffect(fn: (() => (() => void) | void) & any) {
  const prev = currentEffect;
  currentEffect = fn;
  fn.td = null;
  fn();
  currentEffect = prev;
  return fn;
}

export function cleanup(ef) {
  const td = ef.td;
  if (!td) return;
  if (td.delete) {
    td.delete(ef);
  } else if (typeof td === "function") {
    td();
  } else {
    for (const f of td) typeof f === "function" ? f() : f.delete(ef);
  }
}