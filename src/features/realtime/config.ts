const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);

/** Параметры real-time синхронизации (переопределяются env для E2E). */
export const REALTIME = {
  /** Объединение серии событий в одну инвалидацию */
  debounceMs: 300,
  /** Через сколько мс без SSE включать polling fallback */
  fallbackAfterMs: num(import.meta.env.VITE_REALTIME_FALLBACK_MS, 10_000),
  /** Интервал polling tenant-access в режиме fallback */
  pollIntervalMs: num(import.meta.env.VITE_REALTIME_POLL_MS, 30_000),
  backoffBaseMs: 1_000,
  backoffMaxMs: 30_000,
};
