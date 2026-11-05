import { useSyncExternalStore } from 'react';

export interface Notice {
  id: number;
  text: string;
  at: string;
  read: boolean;
}

let notices: Notice[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Центр уведомлений вкладки (колокольчик в шапке кабинета). */
export const noticeStore = {
  push(text: string) {
    notices = [{ id: ++seq, text, at: new Date().toISOString(), read: false }, ...notices].slice(0, 20);
    emit();
  },
  markAllRead() {
    if (!notices.some((n) => !n.read)) return;
    notices = notices.map((n) => ({ ...n, read: true }));
    emit();
  },
  clear() {
    notices = [];
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => notices,
};

export function useNotices() {
  return useSyncExternalStore(noticeStore.subscribe, noticeStore.get, noticeStore.get);
}
