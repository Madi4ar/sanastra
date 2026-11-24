import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  Headset,
  Landmark,
  Menu,
  Presentation,
  School,
  ShieldCheck,
  Star,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { useCurrentUser, homeFor } from '@/auth/auth';
import { track, trackScrollDepth } from './analytics';
import { BRAND, CASES, CLIENT_LOGOS, ENDORSER, ENDORSER_URL, STATS } from './content';
import { DemoForm, type DemoChannel } from './DemoForm';
import { LandingLangProvider, useLandingLang, useLandingText, type LandingLang } from './i18n';
import { FeatureTabs } from './FeatureTabs';
import { BeforeAfter, DashboardMockup, DemoNote } from './mockups';
import { BrandLockup, BrandLogo, Container, CountUp, Endorsement, GhostButton, PrimaryButton, Reveal, Section, SectionHeading, SecondaryButton } from './primitives';
import { FloatingActions } from './FloatingActions';

const NAV_IDS = ['features', 'how', 'audience', 'pricing', 'faq'];

/* ---------------- Header ---------------- */

/** Ориентирование: какая секция сейчас в центре экрана — её пункт меню подсвечивается. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      // «Активна» секция, пересекающая узкую полосу посередине экрана
      { rootMargin: '-45% 0px -50% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return active;
}

function LanguageLinks({ mobile = false }: { mobile?: boolean }) {
  const lang = useLandingLang();
  const t = useLandingText();
  return (
    <div aria-label={t.language.label} className={`flex items-center ${mobile ? 'mt-2 border-t border-ln-border-soft pt-2' : ''}`}>
      <Link to="/" hrefLang="kk" lang="kk" aria-current={lang === 'kk' ? 'page' : undefined} className={`ln-focus inline-flex items-center justify-center rounded-lg px-2.5 text-sm no-underline ${mobile ? 'min-h-11 flex-1' : 'h-11'} ${lang === 'kk' ? 'font-semibold text-ln-ink!' : 'text-ln-ink-2!'}`}>
        {t.language.kk}
      </Link>
      <span aria-hidden className="text-ln-border">/</span>
      <Link to="/ru" hrefLang="ru" lang="ru" aria-current={lang === 'ru' ? 'page' : undefined} className={`ln-focus inline-flex items-center justify-center rounded-lg px-2.5 text-sm no-underline ${mobile ? 'min-h-11 flex-1' : 'h-11'} ${lang === 'ru' ? 'font-semibold text-ln-ink!' : 'text-ln-ink-2!'}`}>
        {t.language.ru}
      </Link>
    </div>
  );
}

function Header() {
  const t = useLandingText();
  const lang = useLandingLang();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(NAV_IDS);
  const { data: user } = useCurrentUser();
  const cabinet = user ? homeFor(user) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Край шапки проявляется, только когда под ней действительно прокручивается контент
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`ln-glass sticky top-0 z-40 border-b transition-colors duration-200 ${
        scrolled || open ? 'border-ln-border-soft' : 'border-transparent'
      }`}
    >
      <Container className="flex h-16 max-w-[1320px]! items-center gap-3">
        <BrandLockup to={lang === 'ru' ? '/ru' : '/'} ariaLabel={t.nav.home} />
        <nav aria-label={t.nav.mainLabel} className="ml-1 hidden items-center gap-0.5 min-[1400px]:flex">
          {t.nav.items.map((n) => {
            const current = active === n.href.slice(1);
            return (
              <a
                key={n.href}
                href={n.href}
                aria-current={current ? 'location' : undefined}
                className={`ln-focus ln-press rounded-full px-2.5 py-2 text-[0.9375rem] whitespace-nowrap no-underline hover:text-ln-ink! active:bg-ln-subtle ${
                  current ? 'font-medium text-ln-ink!' : 'text-ln-ink-2!'
                }`}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <LanguageLinks />
          {cabinet ? (
            <PrimaryButton to={cabinet}>{t.nav.cabinet}</PrimaryButton>
          ) : (
            <>
              <GhostButton to="/login" cta="header">
                {t.nav.login}
              </GhostButton>
              <PrimaryButton href="#demo" cta="header">
                {t.nav.startFree}
              </PrimaryButton>
            </>
          )}
        </div>
        <button
          type="button"
          className="ln-focus ln-press ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ln-ink hover:bg-ln-subtle active:bg-ln-subtle sm:ml-0 min-[1400px]:hidden"
          aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </Container>
      {/* Меню выезжает из шапки и уходит обратно тем же путём; закрытое — недоступно (inert, aria-hidden) */}
      <nav
        id="mobile-nav"
        aria-label={t.nav.mobileLabel}
        aria-hidden={!open}
        inert={!open}
        data-open={open}
        className="ln-sheet absolute inset-x-0 top-full border-b border-ln-border-soft bg-ln-bg min-[1400px]:hidden"
      >
        <Container className="flex flex-col gap-1 py-4">
          {t.nav.items.map((n) => (
            <a
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={active === n.href.slice(1) ? 'location' : undefined}
              className="ln-focus rounded-xl px-3 py-3 text-[1.0625rem] font-medium text-ln-ink! no-underline hover:bg-ln-subtle hover:text-ln-ink! active:bg-ln-subtle"
            >
              {n.label}
            </a>
          ))}
          <LanguageLinks mobile />
          <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
            {cabinet ? (
              <PrimaryButton to={cabinet} className="col-span-2">
                {t.nav.cabinet}
              </PrimaryButton>
            ) : (
              <>
                <SecondaryButton to="/login" cta="mobile_menu">
                  {t.nav.login}
                </SecondaryButton>
                <PrimaryButton href="#demo" cta="mobile_menu" onClick={() => setOpen(false)}>
                  {t.nav.startFree}
                </PrimaryButton>
              </>
            )}
          </div>
        </Container>
      </nav>
    </header>
  );
}

/* ---------------- Hero + Product preview ---------------- */

function Hero() {
  const t = useLandingText();
  return (
    <section aria-labelledby="hero-h" className="relative isolate overflow-hidden pt-16 pb-16 md:pt-24 md:pb-24">
      {/* Бренд-цвет живёт в слое контента: один мягкий свет за макетом, без цветных пятен вокруг заголовка */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[70%]"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 100%, color-mix(in srgb, var(--ln-brand) 18%, transparent) 0%, transparent 70%), radial-gradient(28% 30% at 78% 92%, color-mix(in srgb, var(--ln-highlight) 14%, transparent) 0%, transparent 70%)',
        }}
      />
      <Container>
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="m-0 mb-6 inline-flex max-w-full rounded-full bg-ln-brand-soft px-4 py-1.5 text-[0.9375rem] leading-6 font-medium text-pretty text-ln-accent md:text-[1.0625rem]">
            <span>
              {t.hero.badge.before}
              <a
                href={ENDORSER_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={t.footer.endorse.link}
                onClick={() => track({ event: 'beyim_ustaz_click', placement: 'hero' })}
                className="ln-focus rounded font-semibold text-ln-accent! underline-offset-2 hover:underline"
              >
                {ENDORSER}
              </a>
              {t.hero.badge.after}
            </span>
          </p>
          <h1
            id="hero-h"
            className="m-0 text-[2.5rem] leading-[2.875rem] font-semibold tracking-[-0.035em] text-balance text-ln-ink sm:text-[3.75rem] sm:leading-[4rem] lg:text-[4.75rem] lg:leading-[5rem]"
          >
            {t.hero.title}
          </h1>
          <p className="m-0 mx-auto mt-7 max-w-2xl text-[1.1875rem] leading-[1.875rem] text-pretty text-ln-ink-2 md:text-[1.3125rem] md:leading-8">
            {t.hero.text}
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <PrimaryButton href="#demo" size="lg" cta="hero">
              {t.nav.startFree} <ArrowRight size={18} aria-hidden />
            </PrimaryButton>
            <SecondaryButton href="#demo" size="lg" cta="hero">
              {t.hero.demo}
            </SecondaryButton>
          </div>
          <p className="m-0 mt-5 text-[0.9375rem] leading-6 text-ln-muted">{t.hero.note}</p>
        </Reveal>
        <Reveal variant="scale" className="mx-auto mt-14 max-w-[1080px] md:mt-20" delay={150}>
          <div id="preview" className="scroll-mt-24">
            <DashboardMockup />
            <div className="mt-4 text-center">
              <DemoNote />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- Trust: numbers & logos ---------------- */

/** Подтверждённые цифры — если владелец продукта их предоставил; иначе нейтральная строка доверия без чисел. */
function Trust() {
  const t = useLandingText();
  if (STATS.length) {
    return (
      <Section labelledBy="trust-h" className="py-16! md:py-20!">
        <Container>
          <SectionHeading id="trust-h" title={t.trust.title} />
          <dl className="m-0 mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-[22px] bg-ln-soft p-6 text-center">
                <dd className="tabular m-0 text-[2.25rem] leading-10 font-semibold tracking-[-0.03em] text-ln-ink">{s.value}</dd>
                <dt className="mt-2 text-[0.9375rem] text-ln-ink-2">{s.label}</dt>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
    );
  }
  return (
    <div className="border-y border-ln-border-soft py-8">
      <Container className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
        <p className="m-0 text-[1.0625rem] font-medium text-ln-ink">{t.trust.fallback}</p>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0" aria-label={t.trust.audienceLabel}>
          {t.trust.audiences.map((item) => (
            <li key={item} className="rounded-full bg-ln-soft px-3.5 py-1.5 text-[0.9375rem] text-ln-ink-2">
              {item}
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}

/** Логотипы клиентов: публикуются только с письменного разрешения; на мобильном — горизонтальная прокрутка. */
function ClientLogos() {
  const t = useLandingText();
  if (!CLIENT_LOGOS.length) return null;
  return (
    <Section labelledBy="logos-h" className="py-16! md:py-20!">
      <Container>
        <h2 id="logos-h" className="m-0 text-center text-[1.25rem] font-semibold text-ln-ink">
          {t.trust.logosTitle}
        </h2>
        <ul className="m-0 mt-8 flex list-none snap-x gap-8 overflow-x-auto p-0 pb-2 md:flex-wrap md:justify-center md:overflow-visible">
          {CLIENT_LOGOS.map((l) => (
            <li key={l.name} className="flex shrink-0 snap-start items-center">
              <img src={l.src} width={l.width} height={l.height} alt={l.name} loading="lazy" className="h-10 w-auto opacity-70 grayscale" />
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/* ---------------- Problem / solution ---------------- */

function Problem() {
  const t = useLandingText();
  return (
    <Section labelledBy="problem-h" className="bg-ln-soft">
      <Container>
        <SectionHeading
          id="problem-h"
          title={t.problem.title}
          text={t.problem.text}
        />
        <Reveal className="mt-12 md:mt-16">
          <BeforeAfter />
        </Reveal>
        <ul className="m-0 mt-10 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {t.problem.gains.map((g) => (
            <li key={g} className="flex items-start gap-3 text-[1.0625rem] leading-[1.625rem] text-ln-ink">
              <Check size={20} strokeWidth={2.25} className="mt-1 shrink-0 text-ln-success" aria-hidden />
              {g}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/* ---------------- Chips ---------------- */

/** Мини-превью интерфейса внутри карточки: только сущности и термины реального продукта. */
function Chips({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {items.map((r) => (
        <span key={r} className="rounded-full bg-ln-bg px-3.5 py-1.5 text-[0.9375rem] text-ln-ink-2">
          {r}
        </span>
      ))}
    </div>
  );
}

/* ---------------- How to start ---------------- */

function HowToStart() {
  const t = useLandingText();
  return (
    <Section id="how" labelledBy="how-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="how-h" title={t.start.title} text={t.start.text} />
        <Reveal as="ol" className="ln-stagger m-0 mt-14 grid list-none gap-4 p-0 sm:grid-cols-2 md:mt-20 lg:grid-cols-4 lg:gap-5">
          {t.start.steps.map((s, i) => (
            <li key={s.title} className="ln-lift flex h-full flex-col rounded-[28px] bg-ln-bg p-7" style={{ '--i': i } as React.CSSProperties}>
              <span className="tabular flex h-11 w-11 items-center justify-center rounded-full bg-ln-brand-soft text-[1.0625rem] font-semibold text-ln-accent" aria-hidden>
                {i + 1}
              </span>
              <h3 className="m-0 mt-6 text-[1.25rem] leading-[1.625rem] font-semibold tracking-[-0.015em] text-ln-ink">
                <span className="sr-only">{i + 1}-{t.start.stepLabel}: </span>
                {s.title}
              </h3>
              <p className="m-0 mt-2 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{s.text}</p>
            </li>
          ))}
        </Reveal>
        <div className="mt-10 flex justify-center">
          <PrimaryButton to="/register" size="lg" cta="how_to_start" className="w-full sm:w-auto">
            {t.start.cta} <ArrowRight size={18} aria-hidden />
          </PrimaryButton>
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Roles ---------------- */

const ROLE_ICONS: LucideIcon[] = [Landmark, Presentation, BookOpen];

/** Роли кратко: подробности — во вкладке «Рөлдер мен басқару», здесь только кому что даёт платформа. */
function Roles() {
  const t = useLandingText();
  const roles = [t.roles.admin, t.roles.teacher, t.roles.learner];
  return (
    <Section id="roles" labelledBy="roles-h">
      <Container>
        <SectionHeading id="roles-h" title={t.roles.title} />
        <Reveal as="ul" className="ln-stagger m-0 mt-12 grid list-none gap-4 p-0 md:mt-16 md:grid-cols-3 lg:gap-5">
          {roles.map((r, i) => {
            const Icon = ROLE_ICONS[i]!;
            return (
              <li key={r.eyebrow} className="ln-lift flex h-full flex-col rounded-[28px] bg-ln-soft p-7" style={{ '--i': i } as React.CSSProperties}>
                <Icon size={28} strokeWidth={1.75} className="text-ln-ink-2" aria-hidden />
                <p className="m-0 mt-6 text-[0.9375rem] font-semibold text-ln-muted">{r.eyebrow}</p>
                <h3 className="m-0 mt-1 text-[1.25rem] leading-[1.625rem] font-semibold tracking-[-0.015em] text-ln-ink">{r.title}</h3>
                <p className="m-0 mt-2 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{r.text}</p>
              </li>
            );
          })}
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Analytics ---------------- */

function Analytics() {
  const t = useLandingText();
  const bars = [52, 61, 58, 70, 74, 69, 81, 86];
  return (
    <Section id="analytics" labelledBy="analytics-h">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            id="analytics-h"
            align="left"
            title={t.analytics.title}
            text={t.analytics.text}
          />
          <div className="mt-8">
            <SecondaryButton to="/login" cta="analytics">
              {t.analytics.cta} <ArrowRight size={16} aria-hidden />
            </SecondaryButton>
          </div>
        </div>
        <Reveal variant="scale">
          <div className="ln-shadow rounded-[28px] border border-ln-border-soft bg-ln-bg p-5 md:p-7">
            {/* Фильтры — часть макета, не элементы управления */}
            <div className="mb-3 flex flex-wrap gap-2" aria-hidden>
              {t.analytics.filters.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full border border-ln-border-soft px-3 py-1 text-[0.8125rem] text-ln-ink-2">
                  {f} <ChevronDown size={14} />
                </span>
              ))}
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3">
              {t.analytics.metrics.map((m) => (
                <div key={m.label} className="rounded-2xl bg-ln-soft p-4 md:p-5">
                  <dt className="text-[0.8125rem] leading-[1.125rem] tracking-[0.01em] text-ln-muted">{m.label}</dt>
                  <dd className="tabular m-0 mt-2 text-[1.75rem] leading-8 font-semibold tracking-[-0.02em] text-ln-ink md:text-[2.125rem] md:leading-10">
                    <CountUp value={m.value} />
                  </dd>
                </div>
              ))}
            </dl>
            <div
              className="mt-3 rounded-2xl bg-ln-soft p-4 md:p-5"
              role="img"
              aria-label={t.analytics.chartLabel}
            >
              <p className="m-0 mb-4 text-[0.9375rem] font-medium text-ln-ink">{t.analytics.chartTitle}</p>
              <div className="flex h-28 items-end gap-2" aria-hidden>
                {bars.map((b, i) => (
                  <div key={i} className="ln-bar flex-1 rounded-md bg-ln-brand" style={{ height: `${b}%`, opacity: 0.35 + (i / bars.length) * 0.65, '--i': i } as React.CSSProperties} />
                ))}
              </div>
            </div>
            <DemoNote className="mt-4" />
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Case studies ---------------- */

/** Кейсы клиентов: блок появляется только при наличии подтверждённого кейса (ТЗ, раздел 6.11). */
function Cases() {
  const t = useLandingText();
  if (!CASES.length) return null;
  return (
    <Section id="cases" labelledBy="cases-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="cases-h" title={t.cases.title} />
        <div className="mt-14 grid gap-5 md:mt-20 lg:grid-cols-2">
          {CASES.map((c) => (
            <article key={c.id} className="flex h-full flex-col rounded-[28px] bg-ln-bg p-7 md:p-9" aria-labelledby={`case-${c.id}`}>
              {c.logo && <img src={c.logo.src} width={c.logo.width} height={c.logo.height} alt="" loading="lazy" className="h-9 w-auto" />}
              <h3 id={`case-${c.id}`} className="m-0 mt-5 text-[1.375rem] font-semibold text-ln-ink">
                {c.organization}
              </h3>
              <p className="m-0 mt-3 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{c.problem}</p>
              <Chips items={c.modules} />
              <dl className="m-0 mt-6 grid gap-3 sm:grid-cols-3">
                {c.results.map((r) => (
                  <div key={r.label} className="rounded-2xl bg-ln-soft p-4">
                    <dt className="text-[0.8125rem] text-ln-muted">{r.label}</dt>
                    <dd className="tabular m-0 mt-1 text-[1.0625rem] font-semibold text-ln-ink">
                      {r.before} → {r.after}
                    </dd>
                  </div>
                ))}
              </dl>
              <blockquote className="m-0 mt-6 border-l-2 border-ln-brand pl-4 text-[1.0625rem] leading-[1.625rem] text-ln-ink">
                «{c.quote.text}»
                <footer className="mt-2 text-[0.9375rem] text-ln-muted">
                  {c.quote.author}, {c.quote.role}
                </footer>
              </blockquote>
              <a
                href={c.href}
                onClick={() => track({ event: 'landing_case_open', case_id: c.id })}
                className="ln-focus mt-6 inline-flex items-center gap-1 self-start rounded font-medium text-ln-accent!"
              >
                {t.cases.read} <ArrowRight size={16} aria-hidden />
              </a>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Integrations & Security ---------------- */

type IntegrationStatus = 'ready' | 'api' | 'planned';

/** Коротко: статусы интеграций (честные) и проверяемые формулировки о доступе — без сертификаций и SLA. */
function IntegrationsSecurity() {
  const t = useLandingText();
  return (
    <Section id="integrations" labelledBy="integrations-h" className="bg-ln-soft">
      <Container className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading id="integrations-h" align="left" title={t.integrations.title} text={t.integrations.text} />
          <ul className="m-0 mt-8 flex list-none flex-wrap gap-2 p-0">
            {t.integrations.items.map(({ name, status }) => (
              <li key={name} className="inline-flex items-center gap-2 rounded-full bg-ln-bg py-1.5 pr-1.5 pl-3.5 text-[0.9375rem] text-ln-ink">
                {name}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium ${
                    status === 'planned' ? 'bg-ln-subtle text-ln-ink-2' : 'bg-ln-success-soft text-ln-success'
                  }`}
                >
                  {t.integrations.statuses[status as IntegrationStatus]}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <Reveal>
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} strokeWidth={1.75} className="shrink-0 text-ln-ink" aria-hidden />
            <h3 id="security-h" className="m-0 text-[1.25rem] leading-[1.625rem] font-semibold tracking-[-0.015em] text-ln-ink">
              {t.security.title}
            </h3>
          </div>
          <p className="m-0 mt-3 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{t.security.text}</p>
          <ul className="m-0 mt-6 list-none overflow-hidden rounded-[22px] bg-ln-bg p-0">
            {t.security.items.map((label) => (
              <li key={label} className="flex items-center gap-4 border-b border-ln-border-soft px-5 py-4 text-[1.0625rem] text-ln-ink last:border-b-0">
                <Check size={20} strokeWidth={2.25} className="shrink-0 text-ln-success" aria-label={t.security.present} />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Onboarding & support ---------------- */

function Support() {
  const t = useLandingText();
  return (
    <Section id="support" labelledBy="support-h" className="bg-ln-soft">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <Reveal>
            <Headset size={44} strokeWidth={1.5} className="text-ln-ink" aria-hidden />
          </Reveal>
          <div className="mt-6">
            <SectionHeading
              id="support-h"
              align="left"
              title={t.support.title}
              text={t.support.text}
            />
          </div>
          <div className="mt-8">
            <PrimaryButton href="#demo" size="lg" cta="support" className="w-full sm:w-auto">
              {t.support.cta}
            </PrimaryButton>
          </div>
        </div>
        <Reveal>
          <ul className="m-0 list-none overflow-hidden rounded-[22px] bg-ln-bg p-0">
            {t.support.items.map((label) => (
              <li key={label} className="flex items-center gap-4 border-b border-ln-border-soft px-5 py-4 text-[1.0625rem] text-ln-ink last:border-b-0">
                <Check size={20} strokeWidth={2.25} className="shrink-0 text-ln-success" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Audience ---------------- */

const AUDIENCE_ICONS: LucideIcon[] = [BookOpen, School, Briefcase, Landmark, UsersRound];

function Audience() {
  const t = useLandingText();
  return (
    <Section id="audience" labelledBy="audience-h">
      <Container>
        <SectionHeading id="audience-h" title={t.audience.title} text={t.audience.text} />
        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-6 lg:gap-5">
          {t.audience.items.map(({ title, text }, i) => {
            const Icon = AUDIENCE_ICONS[i]!;
            return (
            <article key={title} className={`flex h-full flex-col rounded-[28px] bg-ln-soft p-7 lg:col-span-2 ${i >= 3 ? 'lg:col-span-3' : ''}`}>
              <Icon size={28} strokeWidth={1.75} className="text-ln-ink-2" aria-hidden />
              <h3 className="m-0 mt-6 text-[1.25rem] leading-[1.625rem] font-semibold tracking-[-0.015em] text-ln-ink">{title}</h3>
              <p className="m-0 mt-2 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{text}</p>
            </article>
            );
          })}
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Pricing ---------------- */

function selectPlan(plan: string, billing_period: string) {
  track({ event: 'landing_pricing_select', plan, billing_period });
}

function Pricing() {
  const t = useLandingText();
  const plans = t.pricing.plans;
  return (
    <Section id="pricing" labelledBy="pricing-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="pricing-h" title={t.pricing.title} text={t.pricing.text} />
        <div className="mt-14 grid items-stretch gap-4 md:mt-20 lg:grid-cols-3 lg:gap-5">
          {plans.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <article
                className={`relative flex h-full flex-col rounded-[28px] bg-ln-bg p-7 md:p-8 ${p.popular ? 'ln-shadow ring-2 ring-ln-brand' : ''}`}
                aria-label={`${p.name} ${t.pricing.tariff}${p.popular ? `, ${t.pricing.recommendedSuffix}` : ''}`}
              >
                {p.popular && (
                  <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-ln-highlight px-3 py-1 text-[0.8125rem] leading-5 font-semibold tracking-[0.01em] whitespace-nowrap text-ln-highlight-ink">
                    <Star size={12} fill="currentColor" aria-hidden /> {t.pricing.recommended}
                  </span>
                )}
                <h3 className="m-0 text-[1.375rem] leading-7 font-semibold tracking-[-0.015em] text-ln-ink">{p.name}</h3>
                <p className="m-0 mt-1 text-[0.9375rem] leading-6 text-ln-muted">{p.text}</p>
                <p className="m-0 mt-5 flex flex-wrap items-end gap-x-2">
                  <span className="tabular text-[2.25rem] leading-[2.75rem] font-semibold tracking-[-0.03em] text-ln-ink">{p.price}</span>
                  <span className="pb-1 text-[1.0625rem] text-ln-muted">{p.period}</span>
                </p>
                <ul className="m-0 mt-6 flex flex-1 list-none flex-col gap-3 border-t border-ln-border-soft p-0 pt-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[0.9375rem] leading-6 text-ln-ink-2">
                      <Check size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ln-ink-2" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.popular ? (
                  <PrimaryButton href="#demo" size="lg" className="mt-8 w-full" cta={`pricing_${p.id}`} onClick={() => selectPlan(p.id, 'month')}>
                    {t.nav.startFree}
                  </PrimaryButton>
                ) : (
                  <SecondaryButton to={`/register?plan=${p.id}`} size="lg" className="mt-8 w-full" onClick={() => selectPlan(p.id, 'month')}>
                    {t.pricing.start}
                  </SecondaryButton>
                )}
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-4 lg:mt-5">
          <article
            aria-label={t.pricing.enterprise.aria}
            className="flex flex-col gap-5 rounded-[28px] bg-ln-bg p-7 md:flex-row md:items-center md:justify-between md:p-8"
          >
            <div>
              <h3 className="m-0 text-[1.375rem] leading-7 font-semibold tracking-[-0.015em] text-ln-ink">{t.pricing.enterprise.name}</h3>
              <p className="m-0 mt-1 text-[0.9375rem] leading-6 text-ln-muted">
                {t.pricing.enterprise.text} <b className="font-semibold text-ln-ink">{t.pricing.enterprise.price}</b>
              </p>
            </div>
            <SecondaryButton href="#demo" size="lg" className="w-full md:w-auto" cta="pricing_enterprise" onClick={() => selectPlan('enterprise', 'contract')}>
              {t.pricing.enterprise.cta}
            </SecondaryButton>
          </article>
        </Reveal>
        <details className="group mt-8 rounded-[22px] bg-ln-bg">
          <summary className="ln-focus flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[22px] px-6 py-4 text-[1.0625rem] font-medium text-ln-ink">
            {t.pricing.compare}
            <ChevronDown size={20} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full min-w-[520px] border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-ln-border py-3 pr-4 font-medium text-ln-muted">
                    {t.pricing.feature}
                  </th>
                  {plans.map((p) => (
                    <th key={p.id} scope="col" className="border-b border-ln-border px-3 py-3 font-semibold text-ln-ink">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.pricing.comparison.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="border-b border-ln-border-soft py-3 pr-4 font-normal text-ln-ink-2">
                      {row.label}
                    </th>
                    {row.values.map((v, i) => (
                      <td key={i} className="tabular border-b border-ln-border-soft px-3 py-3 text-ln-ink">
                        {v === '✓' ? <Check size={18} strokeWidth={2.25} className="text-ln-success" aria-label={t.pricing.yes} /> : v === '—' ? <span aria-label={t.pricing.no}>—</span> : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Container>
    </Section>
  );
}

/* ---------------- FAQ ---------------- */

/** Доступный аккордеон: вопрос — кнопка с aria-expanded/aria-controls, можно раскрыть несколько пунктов сразу. */
function Faq() {
  const t = useLandingText();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        track({ event: 'landing_faq_open', question_id: id });
      }
      return next;
    });
  return (
    <Section id="faq" labelledBy="faq-h">
      <Container className="max-w-[880px]!">
        <SectionHeading id="faq-h" title={t.faq.title} />
        <div className="mt-12 divide-y divide-ln-border border-y border-ln-border md:mt-16">
          {t.faq.items.map((f) => {
            const expanded = open.has(f.id);
            return (
              <div key={f.id}>
                <h3 className="m-0">
                  <button
                    type="button"
                    id={`faq-q-${f.id}`}
                    aria-expanded={expanded}
                    aria-controls={`faq-a-${f.id}`}
                    onClick={() => toggle(f.id)}
                    className="ln-focus flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-lg border-0 bg-transparent py-5 text-left text-[1.125rem] leading-7 font-semibold text-ln-ink"
                  >
                    {f.q}
                    <ChevronDown size={20} className={`shrink-0 text-ln-ink-2 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                </h3>
                <div id={`faq-a-${f.id}`} role="region" aria-labelledby={`faq-q-${f.id}`} hidden={!expanded}>
                  <p className="m-0 pb-6 text-[1.0625rem] leading-[1.75rem] text-ln-ink-2">{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCta({ demo }: { demo: DemoChannel }) {
  const t = useLandingText();
  return (
    <section aria-labelledby="cta-h" className="bg-ln-inverse py-20 md:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <Reveal className="text-center lg:text-left">
          <h2 id="cta-h" className="m-0 text-[2rem] leading-[2.375rem] font-semibold tracking-[-0.03em] text-balance text-white md:text-5xl md:leading-[3.375rem]">
            {t.finalCta.title}
          </h2>
          <p className="m-0 mt-5 text-[1.1875rem] leading-[1.875rem] text-white/80">
            {t.finalCta.text}
          </p>
          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <PrimaryButton href="#demo" size="lg" cta="final_cta">
              {t.nav.startFree}
            </PrimaryButton>
            <a
              href="#demo"
              data-cta="final_cta"
              className="ln-focus ln-press inline-flex h-12 items-center justify-center rounded-full bg-white/10 px-6 text-[1.0625rem] font-medium text-white! no-underline transition-colors hover:bg-white/20 hover:text-white!"
            >
              {t.finalCta.demo}
            </a>
          </div>
        </Reveal>
        <Reveal>
          <DemoForm demo={demo} />
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  const t = useLandingText();
  const lang = useLandingLang();
  return (
    <footer className="bg-ln-soft pt-12 pb-8 md:pt-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <BrandLogo to={lang === 'ru' ? '/ru' : '/'} ariaLabel={t.nav.home} />
            <p className="m-0 mt-4 max-w-xs text-[0.9375rem] leading-6 text-ln-ink-2">{t.footer.tagline}</p>
          </div>
          {/* Desktop: колонки */}
          {t.footer.columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="hidden md:block">
              <p className="m-0 mb-3 text-[0.8125rem] font-semibold tracking-[0.01em] text-ln-ink">{col.title}</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="ln-focus inline-block rounded py-1 text-[0.8125rem] tracking-[0.01em] text-ln-ink-2! no-underline hover:text-ln-ink! hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          {/* Mobile: аккордеон */}
          <div className="divide-y divide-ln-border border-y border-ln-border md:hidden">
            {t.footer.columns.map((col) => (
              <details key={col.title} className="group">
                <summary className="ln-focus flex min-h-11 cursor-pointer list-none items-center justify-between py-3 text-[1.0625rem] font-medium text-ln-ink">
                  {col.title}
                  <ChevronDown size={18} className="transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="m-0 flex list-none flex-col gap-3 p-0 pb-4">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="ln-focus inline-block rounded py-1 text-[1.0625rem] break-all text-ln-ink-2! no-underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
        <div className="mt-8 flex justify-start">
          <LanguageLinks />
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-ln-border pt-6 text-[0.8125rem] tracking-[0.01em] text-ln-muted sm:flex-row sm:justify-between">
          <p className="m-0">
            © {new Date().getFullYear()} {BRAND}. {t.footer.copyright}
          </p>
          <p className="m-0">
            {BRAND} · <Endorsement placement="footer" linkClassName="text-ln-ink-2! hover:text-ln-ink!" />
          </p>
        </div>
      </Container>
    </footer>
  );
}

/* ---------------- SEO ---------------- */

/** Метатеги страницы: title, description, canonical, Open Graph и FAQPage (ответы видимы на странице). При уходе — восстанавливаются. */
function useLandingMeta() {
  const lang = useLandingLang();
  const t = useLandingText();
  useEffect(() => {
    const html = document.documentElement;
    const prevLang = html.lang;
    const prevTitle = document.title;
    html.lang = lang;
    html.style.scrollBehavior = 'smooth';
    document.title = t.seo.title;

    const url = `${window.location.origin}${lang === 'ru' ? '/ru' : '/'}`;
    const added: Element[] = [];
    const restore: (() => void)[] = [];
    const upsert = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      if (el) {
        const prev = el.getAttribute(attr);
        const node = el;
        restore.push(() => (prev === null ? node.removeAttribute(attr) : node.setAttribute(attr, prev)));
      } else {
        el = create();
        document.head.appendChild(el);
        added.push(el);
      }
      el.setAttribute(attr, value);
    };
    const meta = (key: 'name' | 'property', name: string, content: string) =>
      upsert(
        `meta[${key}="${name}"]`,
        () => {
          const m = document.createElement('meta');
          m.setAttribute(key, name);
          return m;
        },
        'content',
        content,
      );
    meta('name', 'description', t.seo.description);
    meta('property', 'og:type', 'website');
    meta('property', 'og:title', t.seo.title);
    meta('property', 'og:description', t.seo.description);
    meta('property', 'og:url', url);
    upsert(
      'link[rel="canonical"]',
      () => {
        const l = document.createElement('link');
        l.rel = 'canonical';
        return l;
      },
      'href',
      url,
    );
    const alternate = (hrefLang: string, href: string) =>
      upsert(
        `link[rel="alternate"][hreflang="${hrefLang}"]`,
        () => {
          const l = document.createElement('link');
          l.rel = 'alternate';
          l.hreflang = hrefLang;
          return l;
        },
        'href',
        href,
      );
    alternate('kk', `${window.location.origin}/`);
    alternate('ru', `${window.location.origin}/ru`);
    alternate('x-default', `${window.location.origin}/`);
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: t.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
    document.head.appendChild(ld);
    added.push(ld);

    return () => {
      html.lang = prevLang;
      html.style.scrollBehavior = '';
      document.title = prevTitle;
      added.forEach((el) => el.remove());
      restore.forEach((fn) => fn());
    };
  }, [lang, t]);
}

/* ---------------- Page ---------------- */

function LandingContent() {
  const t = useLandingText();
  useLandingMeta();
  useEffect(() => trackScrollDepth(), []);
  const demoRef = useRef({ placement: 'final_cta', opened: false });
  const demo = useMemo<DemoChannel>(
    () => ({
      open: (placement) => {
        if (placement) demoRef.current.placement = placement;
        if (demoRef.current.opened) return;
        demoRef.current.opened = true;
        track({ event: 'landing_demo_open', placement: demoRef.current.placement });
      },
      source: () => demoRef.current.placement,
    }),
    [],
  );

  // Делегированный учёт CTA: любая ссылка с data-cta; переход к форме демо — ещё и событие открытия формы
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-cta]');
    if (!a) return;
    const placement = a.dataset.cta ?? '';
    const target = a.getAttribute('href') ?? '';
    track({ event: 'landing_cta_click', placement, label: a.textContent?.trim() ?? '', target });
    if (target === '#demo') {
      demo.open(placement);
      // После прокрутки — фокус в первое поле, чтобы с клавиатуры сразу начать ввод
      window.setTimeout(() => document.getElementById('demo-name')?.focus({ preventScroll: true }), 400);
    }
  };

  return (
    <div
      id="top"
      className="ln-root min-h-screen overflow-x-clip bg-ln-bg text-ln-ink antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, "Segoe UI", sans-serif' }}
      onClick={onClick}
    >
      <a
        href="#main"
        className="ln-focus sr-only rounded-lg bg-ln-brand! px-4 py-2 text-white! focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        {t.nav.skip}
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Trust />
        <ClientLogos />
        <Problem />
        <FeatureTabs />
        <HowToStart />
        <Roles />
        <Analytics />
        <Cases />
        <IntegrationsSecurity />
        <Support />
        <Audience />
        <Pricing />
        <Faq />
        <FinalCta demo={demo} />
      </main>
      <Footer />
      <FloatingActions />
    </div>
  );
}

export function LandingPage({ lang = 'kk' }: { lang?: LandingLang }) {
  return (
    <LandingLangProvider lang={lang}>
      <LandingContent />
    </LandingLangProvider>
  );
}
