import { describe, it, expect } from 'vitest';
import { $signal, staticEffect, staticTextNodeEffect } from '../src/signals';

describe('signals', () => {
  it('staticEffect works', () => {
    const s = $signal(1);
    let count = 0;
    staticEffect(() => {
      s.get();
      count++;
    });
    expect(count).toBe(1);
    s.set(2);
    // Effects are scheduled via microtask
  });

  it('staticTextNodeEffect updates text node', async () => {
    const s = $signal("hello");
    const node = document.createTextNode("");

    // @ts-ignore
    staticTextNodeEffect(node, s.get.bind(s));

    expect(node.data).toBe("hello");

    s.set("world");

    // Wait for microtask
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(node.data).toBe("world");
  });
});
