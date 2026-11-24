import { ArrowLeft, ArrowRight, Check, Code2, KeyRound, LibraryBig, Presentation, Video, Cloud, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { track } from './analytics';
import { useLandingText } from './i18n';
import { GroupMockup, ProductShot, ReportMockup, SHOTS, TeacherMockup } from './mockups';
import { Container, Section, SectionHeading, SecondaryButton } from './primitives';

type Input = 'click' | 'keyboard' | 'swipe';

const INTEGRATION_ICONS: LucideIcon[] = [LibraryBig, Presentation, Video, Cloud, KeyRound, Code2];

/** Статусы интеграций — визуал шестой вкладки: запланированное не выдаётся за готовое. */
function IntegrationStatuses() {
  const t = useLandingText().integrations;
  return (
    <ul className="ln-shadow m-0 grid list-none gap-2 rounded-[20px] border border-ln-border-soft bg-ln-bg p-3 sm:grid-cols-2 sm:p-4">
      {t.items.map(({ name, status }, i) => {
        const Icon = INTEGRATION_ICONS[i]!;
        return (
          <li key={name} className="flex items-center gap-3 rounded-2xl bg-ln-soft p-3">
            <Icon size={20} strokeWidth={1.75} className="shrink-0 text-ln-ink-2" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-ln-ink">{name}</span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium ${
                status === 'planned' ? 'bg-ln-subtle text-ln-ink-2' : 'bg-ln-success-soft text-ln-success'
              }`}
            >
              {t.statuses[status as keyof typeof t.statuses]}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Основной визуал панели: реальный экран продукта, а где экрана нет — макет. */
function Visual({ id }: { id: string }): ReactNode {
  const t = useLandingText().mockups;
  switch (id) {
    case 'courses':
      return <ProductShot {...SHOTS.builder} alt={t.shots.builder} />;
    case 'groups':
      return <GroupMockup />;
    case 'assignments':
      return <TeacherMockup />;
    case 'roles':
      return <ProductShot {...SHOTS.admin} alt={t.shots.admin} />;
    case 'analytics':
      return <ReportMockup />;
    default:
      return <IntegrationStatuses />;
  }
}

function reducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Возможности платформы одним блоком (ТЗ, раздел 7): на desktop — вкладки с плавной сменой панели,
 * на mobile — тот же набор панелей в нативном слайдере со scroll-snap, стрелками и индикатором «1/6».
 * Без autoplay и бесконечной прокрутки; неактивные панели выключены из порядка Tab (inert).
 */
export function FeatureTabs() {
  const t = useLandingText().features;
  const tabs = t.tabs;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const scrollToPanel = (i: number) => {
    const el = trackRef.current;
    const panel = el?.children[i] as HTMLElement | undefined;
    // На desktop дорожка не прокручивается — вызов ничего не делает
    if (el && panel && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: panel.offsetLeft - el.offsetLeft, behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
  };

  const select = (i: number, input: Input) => {
    if (i === activeRef.current) return;
    activeRef.current = i;
    setActive(i);
    track({ event: 'features_tab_view', tab_id: tabs[i]!.id, input });
    if (input !== 'swipe') scrollToPanel(i);
  };

  // Свайп: активная панель определяется по позиции прокрутки после её остановки
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let timer = 0;
    const settle = () => {
      if (el.scrollWidth <= el.clientWidth) return;
      const panels = [...el.children] as HTMLElement[];
      const left = el.scrollLeft;
      let best = 0;
      panels.forEach((p, i) => {
        if (Math.abs(p.offsetLeft - el.offsetLeft - left) < Math.abs(panels[best]!.offsetLeft - el.offsetLeft - left)) best = i;
      });
      if (best !== activeRef.current) {
        activeRef.current = best;
        setActive(best);
        track({ event: 'features_tab_view', tab_id: tabs[best]!.id, input: 'swipe' });
      }
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
    };
  }, [tabs]);

  // Активная вкладка остаётся видимой в прокручиваемом tablist
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [active]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight' ? (active === last ? 0 : active + 1)
      : e.key === 'ArrowLeft' ? (active === 0 ? last : active - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    select(next, 'keyboard');
    tabRefs.current[next]?.focus();
  };

  const step = (dir: 1 | -1) => {
    const to = active + dir;
    if (to < 0 || to >= tabs.length) return;
    track({ event: 'features_next_click', from: tabs[active]!.id, to: tabs[to]!.id });
    select(to, 'click');
  };

  return (
    <Section id="features" labelledBy="features-h">
      <Container>
        <SectionHeading id="features-h" title={t.title} text={t.text} />
        <div
          role="tablist"
          aria-label={t.tabsLabel}
          onKeyDown={onKeyDown}
          className="ln-tablist mx-auto mt-12 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-ln-soft p-1 md:mt-16"
        >
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`ft-tab-${tab.id}`}
              aria-selected={i === active}
              aria-controls={`ft-panel-${tab.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i, 'click')}
              className={`ln-focus min-h-11 shrink-0 cursor-pointer rounded-full border-0 px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors ${
                i === active ? 'bg-ln-bg text-ln-ink shadow-sm' : 'bg-transparent text-ln-ink-2 hover:text-ln-ink'
              }`}
            >
              {tab.tab}
            </button>
          ))}
        </div>

        <div ref={trackRef} className="ln-ft-track mt-6 md:mt-10">
          {tabs.map((tab, i) => (
            <div
              key={tab.id}
              role="tabpanel"
              id={`ft-panel-${tab.id}`}
              aria-labelledby={`ft-tab-${tab.id}`}
              inert={i !== active}
              data-active={i === active}
              className="ln-ft-panel rounded-[28px] bg-ln-soft p-6 md:p-8 lg:p-10"
            >
              <div className="grid items-center gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
                <div>
                  <h3 className="m-0 text-[1.5rem] leading-8 font-semibold tracking-[-0.02em] text-balance text-ln-ink md:text-[1.875rem] md:leading-9">
                    {tab.title}
                  </h3>
                  <p className="m-0 mt-3 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{tab.text}</p>
                  <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 p-0">
                    {tab.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-[1rem] leading-6 text-ln-ink">
                        <Check size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ln-success" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="m-0 mt-6 inline-flex rounded-full bg-ln-bg px-3 py-1 text-[0.8125rem] font-medium text-ln-ink-2">{tab.proof}</p>
                  <div className="mt-6">
                    <SecondaryButton href="#demo" cta={`features_${tab.id}`} className="bg-ln-bg! hover:bg-ln-border-soft!">
                      {t.demo} <ArrowRight size={16} aria-hidden />
                    </SecondaryButton>
                  </div>
                </div>
                <div className="min-w-0">
                  <Visual id={tab.id} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: стрелки и индикатор позиции; на desktop навигация — только вкладки */}
        <div className="mt-4 flex items-center justify-center gap-4 lg:hidden">
          <button
            type="button"
            aria-label={t.prev}
            disabled={active === 0}
            onClick={() => step(-1)}
            className="ln-focus ln-press flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-ln-soft text-ln-ink disabled:cursor-default disabled:opacity-40"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
          <span className="tabular min-w-12 text-center text-[0.9375rem] text-ln-ink-2" aria-live="polite">
            {active + 1} {t.of} {tabs.length}
          </span>
          <button
            type="button"
            aria-label={t.next}
            disabled={active === tabs.length - 1}
            onClick={() => step(1)}
            className="ln-focus ln-press flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-ln-soft text-ln-ink disabled:cursor-default disabled:opacity-40"
          >
            <ArrowRight size={18} aria-hidden />
          </button>
        </div>
      </Container>
    </Section>
  );
}
