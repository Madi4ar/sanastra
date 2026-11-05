/**
 * Межвкладочная инвалидация кэша: после сохранения настроек открытые tenant-интерфейсы
 * в других вкладках получают сигнал и перезапрашивают права (≈1–3 с вместо интервала polling).
 */
type Message = { type: 'tenant-access-invalidated' };

const channel: BroadcastChannel | null =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('superadmin-platform');

export function broadcastTenantAccessInvalidated() {
  channel?.postMessage({ type: 'tenant-access-invalidated' } satisfies Message);
}

export function onCrossTabMessage(handler: (m: Message) => void): () => void {
  if (!channel) return () => undefined;
  const listener = (e: MessageEvent<Message>) => handler(e.data);
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
