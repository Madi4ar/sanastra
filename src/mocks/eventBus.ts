/**
 * Шина событий мок-бэкенда (аналог Redis pub/sub → SSE).
 * Внутри вкладки события доставляются синхронно, между вкладками — через BroadcastChannel,
 * поэтому сохранение в панели суперадмина доходит до кабинета, открытого в соседней вкладке.
 */
import type { TenantEvent } from '@/api/types';

type Listener = (e: TenantEvent) => void;

const TAB_ID = Math.random().toString(36).slice(2);
const listeners = new Set<Listener>();

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('mock-backend-events');

channel?.addEventListener('message', (m: MessageEvent<{ from: string; event: TenantEvent }>) => {
  if (m.data.from !== TAB_ID) listeners.forEach((l) => l(m.data.event));
});

export function publish(event: TenantEvent) {
  listeners.forEach((l) => l(event));
  channel?.postMessage({ from: TAB_ID, event });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
