import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { handlers } from '@/mocks/handlers';
import { resetDb } from '@/mocks/db';
import { realtimeStatus } from '@/features/realtime/realtimeStatus';
import { noticeStore } from '@/shared/notices';
import { FakeEventSource } from './FakeEventSource';

export const server = setupServer(...handlers);

// Полифиллы jsdom для Ant Design
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    // Desktop-брейкпоинты (min-width) считаем выполненными — кабинет рендерится с sidebar
    matches: /min-width/.test(query),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element) => originalGetComputedStyle(elt);

globalThis.EventSource = FakeEventSource as unknown as typeof EventSource;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
beforeEach(() => {
  resetDb();
  noticeStore.clear();
  realtimeStatus.set('idle');
  FakeEventSource.instances = [];
  FakeEventSource.failing = false;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
