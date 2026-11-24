import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Table2,
  Video,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useLandingText } from './i18n';
import { BrandMark } from './primitives';

/** Карточка-рамка макета: radius 20, тень из токенов темы. */
export function MockFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ln-shadow overflow-hidden rounded-[20px] border border-ln-border-soft bg-ln-bg ${className}`}>
      {children}
    </div>
  );
}

function Bar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'success' | 'warning' }) {
  const color = { brand: 'bg-ln-brand', success: 'bg-ln-success', warning: 'bg-ln-warning' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ln-subtle" aria-hidden>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function MockCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-ln-border-soft bg-ln-bg p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ln-ink">
        <span className="text-ln-accent">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

const NAV_ICONS = [LayoutDashboard, BookOpen, ClipboardList, BarChart3, CalendarDays];
const WEEK_VALUES = [40, 65, 50, 80, 70, 30, 20];

/** Большой макет LMS-дашборда для hero. Декоративный: скрыт от скринридеров, описан через aria-label. Данные — демонстрационные. */
export function DashboardMockup() {
  const t = useLandingText().mockups.dashboard;
  return (
    <MockFrame>
      <div role="img" aria-label={t.aria}>
        <div className="flex items-center gap-2 border-b border-ln-border-soft bg-ln-soft px-4 py-3" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="ml-3 hidden rounded-md bg-ln-bg px-3 py-1 text-xs text-ln-muted sm:inline">{t.cabinet}</span>
        </div>
        <div className="flex text-left" aria-hidden>
          <aside className="hidden w-52 shrink-0 border-r border-ln-border-soft bg-ln-soft p-3 md:block">
            <div className="mb-4 flex items-center gap-2 px-2 pt-1">
              <BrandMark size={22} />
              <span className="text-sm font-bold text-ln-ink">Zhuie</span>
            </div>
            {t.nav.map((label, i) => {
              const Icon = NAV_ICONS[i]!;
              const active = i === 0;
              return (
              <div
                key={label}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] tracking-[0.01em] ${
                  active ? 'bg-ln-brand-soft font-semibold text-ln-accent' : 'text-ln-ink-2'
                }`}
              >
                <Icon size={16} />
                {label}
              </div>
              );
            })}
          </aside>
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-lg font-bold text-ln-ink sm:text-xl">{t.greeting}</p>
                <p className="m-0 mt-0.5 text-[0.8125rem] tracking-[0.01em] text-ln-muted">{t.today}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ln-border-soft text-ln-ink-2">
                <Bell size={16} />
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MockCard title={t.myCourses} icon={<BookOpen size={16} />}>
                {t.courses.map((name, i) => {
                  const v = [72, 54, 31][i]!;
                  return (
                  <div key={name} className="mb-2.5 last:mb-0">
                    <div className="mb-1 flex justify-between text-[0.8125rem] tracking-[0.01em] text-ln-ink-2">
                      <span>{name}</span>
                      <span className="tabular font-medium text-ln-ink">{v}%</span>
                    </div>
                    <Bar value={Number(v)} />
                  </div>
                  );
                })}
              </MockCard>
              <MockCard title={t.upcoming} icon={<ClipboardList size={16} />}>
                {t.tasks.map(([title, date], i) => {
                  const urgent = i === 0;
                  return (
                  <div key={title} className="mb-2 flex items-center justify-between gap-2 text-[0.8125rem] tracking-[0.01em] last:mb-0">
                    <span className="truncate text-ln-ink-2">{title}</span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        urgent ? 'bg-ln-warning-soft text-ln-warning' : 'bg-ln-subtle text-ln-ink-2'
                      }`}
                    >
                      {date}
                    </span>
                  </div>
                  );
                })}
              </MockCard>
              <MockCard title={t.progress} icon={<BarChart3 size={16} />}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="tabular m-0 text-3xl font-bold text-ln-ink">68%</p>
                    <p className="m-0 text-xs text-ln-success">{t.weekGain}</p>
                  </div>
                  <div className="flex h-14 items-end gap-1.5">
                    {t.week.map((d, i) => {
                      const v = WEEK_VALUES[i]!;
                      return (
                      <div key={d} className="flex flex-col items-center gap-1">
                        <div className="w-3 rounded-sm bg-ln-brand" style={{ height: `${v * 0.45}px`, opacity: 0.35 + v / 160 }} />
                        <span className="text-[0.625rem] text-ln-muted">{d}</span>
                      </div>
                      );
                    })}
                  </div>
                </div>
              </MockCard>
              <MockCard title={t.results} icon={<CheckCircle2 size={16} />}>
                {t.resultItems.map((title, i) => {
                  const s = [92, 85, 78][i]!;
                  return (
                  <div key={title} className="mb-2 flex items-center justify-between text-[0.8125rem] tracking-[0.01em] last:mb-0">
                    <span className="text-ln-ink-2">{title}</span>
                    <span className="tabular font-semibold text-ln-ink">{s}/100</span>
                  </div>
                  );
                })}
              </MockCard>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-ln-border-soft bg-ln-soft p-3 text-[0.8125rem] tracking-[0.01em]">
              <CalendarDays size={16} className="shrink-0 text-ln-accent" />
              <span className="text-ln-ink-2">
                <b className="font-semibold text-ln-ink">{t.eventTime}</b> · {t.event}
              </span>
              <span className="ml-auto hidden items-center gap-1 rounded-md bg-ln-brand-soft px-2 py-1 text-xs font-medium text-ln-accent sm:inline-flex">
                <Video size={12} /> {t.join}
              </span>
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** Интерфейс преподавателя: проверка работ. */
export function TeacherMockup() {
  const t = useLandingText().mockups.teacher;
  const scores = [92, 85, null, null];
  return (
    <MockFrame>
      <div className="p-5 sm:p-6" role="img" aria-label={t.aria}>
        <div aria-hidden>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-medium text-ln-muted">{t.course}</p>
              <p className="m-0 font-semibold text-ln-ink">{t.assignment}</p>
            </div>
            <span className="rounded-md bg-ln-brand-soft px-2 py-1 text-xs font-semibold text-ln-accent">{t.submitted}</span>
          </div>
          <div className="divide-y divide-ln-border-soft rounded-xl border border-ln-border-soft">
            {t.rows.map((row, i) => {
              const name = row[0]!;
              const status = row[1]!;
              const score = scores[i];
              return (
              <div key={name} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ln-subtle text-xs font-semibold text-ln-ink-2">
                  {name.slice(0, 1)}
                </span>
                <span className="flex-1 text-ln-ink">{name}</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    score ? 'bg-ln-success-soft text-ln-success' : 'bg-ln-warning-soft text-ln-warning'
                  }`}
                >
                  {status}
                </span>
                <span className="tabular w-14 text-right font-semibold text-ln-ink">{score ? `${score}` : '—'}</span>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** Группа и расписание — визуал вкладки «Топтар мен кесте» (демонстрационные данные). */
export function GroupMockup() {
  const t = useLandingText().mockups.group;
  return (
    <MockFrame>
      <div className="p-5 sm:p-6" role="img" aria-label={t.aria}>
        <div aria-hidden>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-medium text-ln-muted">{t.program}</p>
              <p className="m-0 font-semibold text-ln-ink">{t.name}</p>
            </div>
            <span className="rounded-md bg-ln-success-soft px-2 py-1 text-xs font-semibold text-ln-success">{t.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-ln-soft p-3">
              <p className="m-0 text-xs text-ln-muted">{t.periodLabel}</p>
              <p className="tabular m-0 mt-1 font-semibold text-ln-ink">{t.period}</p>
            </div>
            <div className="rounded-xl bg-ln-soft p-3">
              <p className="m-0 text-xs text-ln-muted">{t.membersLabel}</p>
              <p className="tabular m-0 mt-1 font-semibold text-ln-ink">{t.members}</p>
            </div>
          </div>
          <p className="m-0 mt-4 mb-2 text-xs font-medium text-ln-muted">{t.scheduleLabel}</p>
          <div className="divide-y divide-ln-border-soft rounded-xl border border-ln-border-soft">
            {t.schedule.map(([when, what]) => (
              <div key={what} className="flex items-center gap-3 px-4 py-3 text-sm">
                <CalendarDays size={16} className="shrink-0 text-ln-ink-2" />
                <span className="tabular w-24 shrink-0 text-ln-ink-2">{when}</span>
                <span className="min-w-0 flex-1 truncate text-ln-ink">{what}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** Отчёт по группам — визуал вкладки «Аналитика»: только метрики, которые есть в продукте. */
export function ReportMockup() {
  const t = useLandingText().mockups.report;
  return (
    <MockFrame>
      <div className="p-5 sm:p-6" role="img" aria-label={t.aria}>
        <div aria-hidden>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 font-semibold text-ln-ink">{t.title}</p>
            <span className="rounded-full border border-ln-border-soft px-3 py-1 text-xs text-ln-ink-2">{t.period}</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-ln-border-soft text-sm">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 bg-ln-soft px-4 py-2.5 text-xs font-medium text-ln-muted">
              {t.cols.map((c) => (
                <span key={c} className="truncate">{c}</span>
              ))}
            </div>
            {t.rows.map((row) => (
              <div key={row[0]} className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 border-t border-ln-border-soft px-4 py-3">
                <span className="truncate text-ln-ink">{row[0]}</span>
                <span className="flex flex-col gap-1">
                  <span className="tabular font-semibold text-ln-ink">{row[1]}</span>
                  <Bar value={parseInt(row[1]!, 10)} />
                </span>
                <span className="tabular text-ln-ink-2">{row[2]}</span>
                <span className="tabular text-ln-ink-2">{row[3]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

export function DemoNote({ className = '' }: { className?: string }) {
  const t = useLandingText();
  return (
    <p className={`m-0 inline-flex items-center gap-1.5 rounded-full bg-ln-subtle px-3 py-1 text-[0.8125rem] tracking-[0.01em] text-ln-ink-2 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-ln-muted" aria-hidden />
      {t.mockups.demoNote}
    </p>
  );
}

/** Область скриншота 1440×900 в пикселях исходника: показываем тематический кусок, а не весь экран. */
export type ShotCrop = { x: number; y: number; w: number; h: number };

const SHOT_W = 1440;
const SHOT_H = 900;

/** Прогресс входа элемента в экран 0→1 — пишется в CSS-переменную --p, без перерисовки React. */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 — верх элемента у нижнего края экрана, 1 — элемент поднялся на треть экрана
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.65)));
      el.style.setProperty('--p', p.toFixed(3));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return ref;
}

function cropVars(prefix: string, c: ShotCrop) {
  return {
    [`--${prefix}ar`]: `${c.w} / ${c.h}`,
    [`--${prefix}iw`]: `${(SHOT_W / c.w) * 100}%`,
    [`--${prefix}il`]: `${(-c.x / c.w) * 100}%`,
    [`--${prefix}it`]: `${(-c.y / c.h) * 100}%`,
  };
}

/**
 * Реальный экран продукта в рамке браузера: при прокрутке «выпрямляется» из наклона,
 * при наведении камера мягко приближается. crop — тематический кусок исходного скриншота 1440×900.
 */
export function ProductShot({
  src,
  alt,
  crop = { x: 0, y: 0, w: SHOT_W, h: SHOT_H },
  mobileCrop,
  className = '',
  eager = false,
}: {
  src: string;
  alt: string;
  crop?: ShotCrop;
  /** Тематический кусок для телефона: полный экран там нечитаем. */
  mobileCrop?: ShotCrop;
  className?: string;
  eager?: boolean;
}) {
  const t = useLandingText().mockups.shots;
  const ref = useScrollProgress<HTMLElement>();
  return (
    <figure ref={ref} className={`ln-shot m-0 ${className}`}>
      <div className="ln-shot-frame ln-shadow overflow-hidden rounded-[20px] border border-ln-border-soft bg-ln-bg">
        <div className="flex items-center gap-2 border-b border-ln-border-soft bg-ln-soft px-4 py-2.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-ln-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-ln-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-ln-border" />
          <span className="ml-auto min-w-0 truncate rounded-full bg-ln-bg px-2.5 py-0.5 text-[0.75rem] whitespace-nowrap text-ln-muted">{t.badge}</span>
        </div>
        {/* Desktop — crop, телефон — mobileCrop: переключение через CSS-переменные без второй картинки */}
        <div className="ln-shot-view relative overflow-hidden" style={{ ...cropVars('', crop), ...cropVars('m-', mobileCrop ?? crop) } as React.CSSProperties}>
          <img
            src={src}
            alt={alt}
            width={SHOT_W}
            height={SHOT_H}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="ln-shot-img absolute h-auto max-w-none"
          />
        </div>
      </div>
    </figure>
  );
}

/** Скриншоты реальных экранов (демо-данные из локальной версии продукта). */
export const SHOTS = {
  admin: {
    src: '/landing/admin-dashboard.webp',
    crop: { x: 248, y: 64, w: 1192, h: 836 },
    mobileCrop: { x: 270, y: 170, w: 580, h: 400 },
  },
  builder: {
    src: '/landing/course-builder.webp',
    crop: { x: 270, y: 64, w: 1150, h: 760 },
    mobileCrop: { x: 290, y: 300, w: 620, h: 380 },
  },
  programs: {
    src: '/landing/programs.webp',
    crop: { x: 270, y: 64, w: 1150, h: 640 },
    mobileCrop: { x: 290, y: 250, w: 620, h: 360 },
  },
} as const;

const SCATTERED_ICONS = [FileText, MessageSquare, CalendarDays, Table2];

/** «До / после»: разрозненные инструменты против единого экрана. На мобильном — друг под другом. */
export function BeforeAfter() {
  const t = useLandingText().mockups;
  const ba = t.beforeAfter;
  return (
    <div className="grid items-start gap-4 md:grid-cols-[0.8fr_1.2fr] md:gap-5">
      <figure className="m-0 rounded-[28px] border border-dashed border-ln-border bg-ln-bg p-6 md:p-8">
        <figcaption className="mb-5 text-[0.9375rem] font-semibold text-ln-muted">{ba.before}</figcaption>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
          {ba.scattered.map(({ title, where }, i) => {
            const Icon = SCATTERED_ICONS[i]!;
            return (
              <li key={title} className={`ln-scatter rounded-2xl bg-ln-soft p-4 ${i % 2 ? 'md:translate-y-3 md:rotate-2' : 'md:-rotate-2'}`}>
                <Icon size={20} strokeWidth={1.75} className="text-ln-muted" aria-hidden />
                <p className="m-0 mt-3 text-[0.9375rem] font-semibold text-ln-ink">{title}</p>
                <p className="m-0 mt-0.5 text-[0.8125rem] tracking-[0.01em] text-ln-muted">{where}</p>
              </li>
            );
          })}
        </ul>
      </figure>
      <div>
        <p className="m-0 mb-4 flex items-center gap-2 text-[0.9375rem] font-semibold text-ln-ink">
          <BrandMark size={22} /> {ba.after}
        </p>
        <ProductShot {...SHOTS.programs} alt={t.shots.programs} />
        <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          {ba.unified.map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-full bg-ln-bg px-3.5 py-1.5 text-[0.9375rem] text-ln-ink">
              <CheckCircle2 size={16} className="shrink-0 text-ln-success" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
