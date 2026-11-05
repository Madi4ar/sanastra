import { setupWorker } from 'msw/browser';
import { createSseHandler, handlers, runModuleExpirations } from './handlers';
import { resetDb } from './db';

export const worker = setupWorker(...handlers, createSseHandler());

// Cron worker: отключение временных модулей по наступлении срока действия
setInterval(() => runModuleExpirations(), 5_000);

declare global {
  interface Window {
    __mock?: {
      reset: () => void;
      simulatePayment: (tenantIdOrSlug: string) => Promise<unknown>;
      /** Имитация недоступности SSE (для проверки polling fallback) */
      setSseDisabled: (disabled: boolean) => void;
    };
  }
}

/** Dev-утилиты для ручной проверки и E2E. */
window.__mock = {
  reset: resetDb,
  simulatePayment: (id) => fetch(`/api/__dev/simulate-payment/${id}`, { method: 'POST' }).then((r) => r.json()),
  setSseDisabled: (disabled) => {
    try {
      if (disabled) localStorage.setItem('mock.sseDisabled', '1');
      else localStorage.removeItem('mock.sseDisabled');
    } catch {
      /* ignore */
    }
  },
};
