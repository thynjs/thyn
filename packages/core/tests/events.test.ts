import { describe, it, expect, vi, afterEach } from 'vitest';
import { addEvent } from '../src/events';

describe('Event Delegation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    // We can't easily clear delegatedEvents set or remove document listeners without exposing internal state
    // but tests should be robust enough.
  });

  it('delegates click events', () => {
    const div = document.createElement('div');
    const handler = vi.fn();
    document.body.appendChild(div);

    addEvent(div, 'click', handler);

    div.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles event bubbling', () => {
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    addEvent(parent, 'click', parentHandler);
    addEvent(child, 'click', childHandler);

    child.click();

    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).toHaveBeenCalledTimes(1);
  });

  it('stops propagation when bubbling', () => {
    const parent = document.createElement('div');
    const child = document.createElement('button');
    parent.appendChild(child);
    document.body.appendChild(parent);

    const parentHandler = vi.fn();
    const childHandler = vi.fn((e) => e.stopPropagation());

    addEvent(parent, 'click', parentHandler);
    addEvent(child, 'click', childHandler);

    child.click();

    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it('updates handlers', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    addEvent(div, 'click', handler1);
    div.click();
    expect(handler1).toHaveBeenCalledTimes(1);

    addEvent(div, 'click', handler2);
    div.click();
    expect(handler1).toHaveBeenCalledTimes(1); // Not called again
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it('removes handlers', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const handler = vi.fn();
    addEvent(div, 'click', handler);
    div.click();
    expect(handler).toHaveBeenCalledTimes(1);

    addEvent(div, 'click', undefined);
    div.click();
    expect(handler).toHaveBeenCalledTimes(1); // Not called again
  });

  it('handles non-delegated events directly (mouseenter)', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const handler = vi.fn();

    addEvent(div, 'mouseenter', handler);

    // Dispatch event manually
    const event = new MouseEvent('mouseenter', { bubbles: false });
    div.dispatchEvent(event);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('updates direct handlers correctly', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    addEvent(div, 'mouseenter', handler1);
    div.dispatchEvent(new MouseEvent('mouseenter'));
    expect(handler1).toHaveBeenCalledTimes(1);

    addEvent(div, 'mouseenter', handler2);
    div.dispatchEvent(new MouseEvent('mouseenter'));
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    addEvent(div, 'mouseenter', null);
    div.dispatchEvent(new MouseEvent('mouseenter'));
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});
