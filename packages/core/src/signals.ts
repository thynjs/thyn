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

// 1. Define the Overloaded Interface for the Signal function
export interface Signal<T> {
  (): T;                                   // Getter
  (newValue: T): void;                     // Setter
  (updater: (prev: T) => T): void;         // Updater
}

export function $signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subs = new Set<any>();
  return function (newValue?: T | ((prev: T) => T)) {
    if (!arguments.length) {
      if (currentEffect) {
        subs.add(currentEffect);
        const td = currentEffect.td;
        currentEffect.td = !td ? subs : (Array.isArray(td) ? (td.push(subs), td) : [td, subs]);
      }
      return value;
    }
    newValue = typeof newValue === "function" ? (newValue as (prev: T) => T)(value) : newValue as T;
    if (newValue !== value) {
      value = newValue as T;
      subs.forEach(scheduleEffect);
    }
  } as Signal<T>;
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
  fn.td = null;
  const prev = currentEffect;
  currentEffect = fn;
  fn();
  currentEffect = prev;
  collectEffect(fn);
  return fn;
}

export function uncollectedStaticEffect(fn: (() => (() => void) | void) & any) {
  fn.td = null;
  const prev = currentEffect;
  currentEffect = fn;
  fn();
  currentEffect = prev;
  return fn;
}

export function cleanup(ef) {
  if (!ef.td) return;
  if (ef.td.delete) {
    ef.td.delete(ef);
  } else if (typeof ef.td === "function") {
    ef.td();
  } else {
    for (const f of ef.td) typeof f === "function" ? f() : f.delete(ef);
  }
}