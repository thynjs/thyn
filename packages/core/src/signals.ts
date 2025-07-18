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
        if (!currentEffect.td) {
          currentEffect.td = subs;
        } else if (Array.isArray(currentEffect.td)) {
          currentEffect.td.push(subs);
        } else {
          currentEffect.td = [currentEffect.td, subs];          
        }
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
  if (!ef.td) return;
  if (Array.isArray(ef.td)) {
    for (const f of ef.td) typeof f === "function" ? f() : f.delete(ef);
  } else {
    typeof ef.td === "function" ? ef.td() : ef.td.delete(ef);
  }
}
