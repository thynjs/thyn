import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addEvent } from '../src/events';

describe('Event Delegation', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('delegates click events', () => {
    const handler = vi.fn();
    const btn = document.createElement('button');
    root.appendChild(btn);

    addEvent(btn, 'click', handler);

    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sets correct currentTarget in handler', () => {
    const handler = vi.fn(function(e) {
      expect(this).toBe(btn);
      // Note: we can't easily mock e.currentTarget being read-only on native events
      // but checking `this` is a good proxy for what frameworks provide
    });
    const btn = document.createElement('button');
    root.appendChild(btn);

    addEvent(btn, 'click', handler);

    btn.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('delegates focus events via focusin', () => {
    const handler = vi.fn();
    const input = document.createElement('input');
    root.appendChild(input);

    addEvent(input, 'focus', handler);

    // Focus doesn't bubble, but we expect our delegation to handle it (likely via focusin)
    // Dispatching 'focus' directly on element won't bubble to document.
    // So we rely on the framework listening to 'focusin' on document.
    // Or, if we use capture, it catches 'focus'.
    // Let's see what happens if we dispatch focus.
    input.focus();
    // input.focus() triggers a 'focus' event.

    // If the implementation uses focusin on document, we need to check if jsdom fires focusin on focus.
    // JSDOM does support focusin/focusout.

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles non-bubbling events like scroll by direct attachment', () => {
    const handler = vi.fn();
    const div = document.createElement('div');
    div.style.height = '100px';
    div.style.overflow = 'scroll';
    div.innerHTML = '<div style="height: 200px"></div>';
    root.appendChild(div);

    addEvent(div, 'scroll', handler);

    div.dispatchEvent(new Event('scroll'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops propagation correctly', () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn((e) => e.stopPropagation());

    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);
    root.appendChild(parent);

    addEvent(parent, 'click', parentHandler);
    addEvent(child, 'click', childHandler);

    child.click();

    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();
  });
});
