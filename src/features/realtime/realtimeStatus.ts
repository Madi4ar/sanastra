import { useSyncExternalStore } from 'react';

/**
 * idle — нет соединения (нет tenant context); connecting/open — штатно;
 * reconnecting — кратковременный разрыв (ничего не показываем пользователю);
 * fallback — SSE недоступен длительно, работает polling.
 */
export type RealtimeStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'fallback';

let status: RealtimeStatus = 'idle';
const listeners = new Set<() => void>();

export const realtimeStatus = {
  get: () => status,
  set(next: RealtimeStatus) {
    if (next === status) return;
    status = next;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get, realtimeStatus.get);
}
