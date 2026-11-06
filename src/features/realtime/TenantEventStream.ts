import type { TenantEvent, TenantEventType } from '@/api/types';
import { REALTIME } from './config';
import type { RealtimeStatus } from './realtimeStatus';

export const TENANT_EVENT_TYPES: TenantEventType[] = [
  'tenant-config.updated',
  'subscription.updated',
  'subscription.blocked',
  'subscription.expired',
  'module.disabled',
  'limits.updated',
  'permissions.updated',
];

interface Options {
  url: string;
  onEvent: (event: TenantEvent) => void;
  /** Соединение восстановлено после разрыва — нужно перезапросить данные, чтобы не пропустить изменения */
  onReconnected: () => void;
  onStatus: (status: RealtimeStatus) => void;
  config?: Partial<typeof REALTIME>;
}

/**
 * Одно SSE-соединение на вкладку. Собственный reconnect с экспоненциальным backoff
 * (нативный автоповтор EventSource не даёт управлять задержкой и не срабатывает после non-200).
 */
export class TenantEventStream {
  private es: EventSource | null = null;
  private attempts = 0;
  private everOpened = false;
  private closed = false;
  private status: RealtimeStatus = 'idle';
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly cfg: typeof REALTIME;

  constructor(private readonly opts: Options) {
    this.cfg = { ...REALTIME, ...opts.config };
  }

  start() {
    this.connect();
  }

  close() {
    this.closed = true;
    this.es?.close();
    this.es = null;
    clearTimeout(this.retryTimer);
    clearTimeout(this.fallbackTimer);
    this.setStatus('idle');
  }

  private setStatus(s: RealtimeStatus) {
    this.status = s;
    this.opts.onStatus(s);
  }

  private connect() {
    if (this.closed) return;
    if (typeof EventSource === 'undefined') {
      this.setStatus('fallback');
      return;
    }
    if (this.status !== 'fallback') this.setStatus(this.attempts ? 'reconnecting' : 'connecting');

    const es = new EventSource(this.opts.url, { withCredentials: true });
    this.es = es;

    es.onopen = () => {
      const isReconnect = this.everOpened || this.attempts > 0;
      this.everOpened = true;
      this.attempts = 0;
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = undefined;
      this.setStatus('open');
      if (isReconnect) this.opts.onReconnected();
    };

    TENANT_EVENT_TYPES.forEach((type) =>
      es.addEventListener(type, (m) => {
        try {
          const data = JSON.parse((m as MessageEvent<string>).data) as TenantEvent;
          this.opts.onEvent({ ...data, type });
        } catch {
          /* некорректное событие игнорируем — данные всё равно придут через refetch */
        }
      }),
    );

    es.onerror = () => {
      es.close();
      if (this.es === es) this.es = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    if (this.status !== 'fallback') {
      this.setStatus('reconnecting');
      this.fallbackTimer ??= setTimeout(() => {
        if (!this.closed && this.status !== 'open') this.setStatus('fallback');
      }, this.cfg.fallbackAfterMs);
    }
    const exp = Math.min(this.cfg.backoffMaxMs, this.cfg.backoffBaseMs * 2 ** this.attempts);
    const jitter = exp * (0.8 + Math.random() * 0.4);
    this.attempts += 1;
    this.retryTimer = setTimeout(() => this.connect(), jitter);
  }
}
