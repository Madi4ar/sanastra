import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeStatus } from './realtimeStatus';
import { TenantEventStream } from './TenantEventStream';

/** Управляемый EventSource для проверки reconnect/fallback. */
class ControlledES {
  static all: ControlledES[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  listeners = new Map<string, (e: MessageEvent<string>) => void>();
  constructor(public url: string) {
    ControlledES.all.push(this);
  }
  addEventListener(t: string, l: (e: MessageEvent<string>) => void) {
    this.listeners.set(t, l);
  }
  close() {
    this.closed = true;
  }
  static last() {
    return ControlledES.all[ControlledES.all.length - 1]!;
  }
}

describe('TenantEventStream', () => {
  let original: typeof EventSource;
  beforeEach(() => {
    vi.useFakeTimers();
    original = globalThis.EventSource;
    globalThis.EventSource = ControlledES as unknown as typeof EventSource;
    ControlledES.all = [];
  });
  afterEach(() => {
    vi.useRealTimers();
    globalThis.EventSource = original;
  });

  function make() {
    const statuses: RealtimeStatus[] = [];
    const events: string[] = [];
    let reconnected = 0;
    const stream = new TenantEventStream({
      url: '/api/tenant/events?clientSlug=academy',
      onEvent: (e) => events.push(e.type),
      onReconnected: () => (reconnected += 1),
      onStatus: (s) => statuses.push(s),
      config: { fallbackAfterMs: 5_000, backoffBaseMs: 1_000, backoffMaxMs: 8_000 },
    });
    return { stream, statuses, events, reconnects: () => reconnected };
  }

  it('доставляет типизированные события', () => {
    const { stream, events } = make();
    stream.start();
    ControlledES.last().onopen?.();
    ControlledES.last().listeners.get('limits.updated')!(
      new MessageEvent('limits.updated', { data: JSON.stringify({ changed: ['limits'] }) }),
    );
    expect(events).toEqual(['limits.updated']);
    stream.close();
  });

  it('reconnect с backoff и refetch после восстановления', () => {
    const { stream, statuses, reconnects } = make();
    stream.start();
    ControlledES.last().onopen?.();
    expect(reconnects()).toBe(0); // первое подключение — не reconnect

    ControlledES.last().onerror?.();
    expect(statuses.at(-1)).toBe('reconnecting');
    expect(ControlledES.all).toHaveLength(1);
    vi.advanceTimersByTime(1_300);
    expect(ControlledES.all).toHaveLength(2);
    ControlledES.last().onopen?.();
    expect(statuses.at(-1)).toBe('open');
    expect(reconnects()).toBe(1);
    stream.close();
  });

  it('длительная недоступность SSE включает fallback-режим (polling)', () => {
    const { stream, statuses } = make();
    stream.start();
    for (let i = 0; i < 4; i++) {
      ControlledES.last().onerror?.();
      vi.advanceTimersByTime(2_500);
    }
    expect(statuses).toContain('fallback');
    // соединение продолжает восстанавливаться; при успехе fallback выключается
    ControlledES.last().onopen?.();
    expect(statuses.at(-1)).toBe('open');
    stream.close();
    expect(statuses.at(-1)).toBe('idle');
  });

  it('close закрывает соединение и не переподключается', () => {
    const { stream } = make();
    stream.start();
    const es = ControlledES.last();
    stream.close();
    expect(es.closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(ControlledES.all).toHaveLength(1);
  });
});
