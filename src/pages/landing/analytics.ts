/** События аналитики лендинга (ТЗ, раздел 12). Персональные данные форм в параметры не передаются. */
export type LandingEvent =
  | { event: 'landing_cta_click'; placement: string; label: string; target: string }
  | { event: 'landing_demo_open'; placement: string }
  | { event: 'landing_demo_submit'; source: string }
  | { event: 'landing_pricing_select'; plan: string; billing_period: string }
  | { event: 'landing_faq_open'; question_id: string }
  | { event: 'landing_case_open'; case_id: string }
  | { event: 'landing_scroll_depth'; depth: 25 | 50 | 75 | 100 };

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Отправка в dataLayer (GTM / Яндекс Метрика подключаются к нему) и в DOM-событие для собственных подписчиков. */
export function track(payload: LandingEvent) {
  if (typeof window === 'undefined') return;
  (window.dataLayer ??= []).push({ ...payload });
  window.dispatchEvent(new CustomEvent('landing:analytics', { detail: payload }));
}

const DEPTHS = [25, 50, 75, 100] as const;

/** Глубина просмотра: каждый порог отправляется один раз за визит страницы. Возвращает функцию отписки. */
export function trackScrollDepth() {
  const sent = new Set<number>();
  const onScroll = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 100;
    for (const d of DEPTHS) {
      if (pct >= d - 0.5 && !sent.has(d)) {
        sent.add(d);
        track({ event: 'landing_scroll_depth', depth: d });
      }
    }
    if (sent.size === DEPTHS.length) window.removeEventListener('scroll', onScroll);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}
