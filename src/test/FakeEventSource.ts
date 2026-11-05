import { getSession, load } from '@/mocks/db';
import { subscribe } from '@/mocks/eventBus';

type Handler = (e: MessageEvent<string>) => void;

/**
 * EventSource для jsdom: подключается к шине событий мок-бэкенда с теми же правилами,
 * что и SSE-обработчик MSW (сессия, принадлежность организации). Реальный SSE проверяется в E2E.
 */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  /** Имитация недоступности SSE */
  static failing = false;

  readonly url: string;
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private unsubscribe: (() => void) | null = null;
  private closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
    setTimeout(() => this.open(), 0);
  }

  private open() {
    if (this.closed) return;
    const session = getSession();
    const slug = new URL(this.url, 'http://localhost').searchParams.get('clientSlug');
    const org = load().organizations.find((o) => o.clientSlug === slug);
    if (FakeEventSource.failing || !session || !org) {
      this.readyState = 2;
      this.onerror?.(new Event('error'));
      return;
    }
    this.readyState = 1;
    this.unsubscribe = subscribe((e) => {
      if (e.tenantId === org.tenantId) this.emit(e.type, JSON.stringify(e));
    });
    this.onopen?.(new Event('open'));
  }

  addEventListener(type: string, handler: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: Handler) {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, data: string) {
    this.handlers.get(type)?.forEach((h) => h(new MessageEvent(type, { data })));
  }

  close() {
    this.closed = true;
    this.readyState = 2;
    this.unsubscribe?.();
  }

  /** Тестовый хелпер: обрыв соединения */
  drop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.readyState = 2;
    this.onerror?.(new Event('error'));
  }

  static get current() {
    return [...FakeEventSource.instances].reverse().find((i) => !i.closed && i.readyState === 1);
  }
}
