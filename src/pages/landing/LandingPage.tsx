import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Code2,
  FileStack,
  Cloud,
  Headset,
  History,
  KeyRound,
  Landmark,
  LibraryBig,
  LockKeyhole,
  Menu,
  MessageSquare,
  Plus,
  Presentation,
  School,
  ShieldCheck,
  SquareCheckBig,
  Star,
  Upload,
  Users,
  UsersRound,
  Video,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useCurrentUser, homeFor } from '@/auth/auth';
import { track, trackScrollDepth } from './analytics';
import { BRAND, CASES, CLIENT_LOGOS, FAQ, PLANS, PLAN_COMPARISON, SALES_EMAIL, STATS, SUPPORT_EMAIL } from './content';
import { DemoForm, type DemoChannel } from './DemoForm';
import { AdminMockup, BeforeAfter, CourseBuilderMockup, DashboardMockup, DemoNote, LearnerMockup, TeacherMockup } from './mockups';
import { BrandLogo, Container, GhostButton, PrimaryButton, Reveal, Section, SectionHeading, SecondaryButton } from './primitives';

const NAV = [
  { href: '#features', label: 'Мүмкіндіктер' },
  { href: '#how', label: 'Қалай жұмыс істейді' },
  { href: '#audience', label: 'Кімге арналған' },
  { href: '#pricing', label: 'Тарифтер' },
  { href: '#faq', label: 'Сұрақтар' },
];

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

const NAV_IDS = NAV.map((n) => n.href.slice(1));

function Header() {
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
      <Container className="flex h-16 items-center gap-4">
        <BrandLogo />
        <nav aria-label="Негізгі навигация" className="ml-2 hidden items-center gap-0.5 lg:flex">
          {NAV.map((n) => {
            const current = active === n.href.slice(1);
            return (
              <a
                key={n.href}
                href={n.href}
                aria-current={current ? 'location' : undefined}
                className={`ln-focus ln-press rounded-full px-3 py-2 text-[0.9375rem] whitespace-nowrap no-underline hover:text-ln-ink! active:bg-ln-subtle ${
                  current ? 'font-medium text-ln-ink!' : 'text-ln-ink-2!'
                }`}
              >
                {n.label}
              </a>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {cabinet ? (
            <PrimaryButton to={cabinet}>Кабинетке өту</PrimaryButton>
          ) : (
            <>
              <GhostButton to="/login" cta="header">
                Жүйеге кіру
              </GhostButton>
              <PrimaryButton to="/register" cta="header">
                Тегін бастау
              </PrimaryButton>
            </>
          )}
        </div>
        <button
          type="button"
          className="ln-focus ln-press ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ln-ink hover:bg-ln-subtle active:bg-ln-subtle sm:ml-0 lg:hidden"
          aria-label={open ? 'Мәзірді жабу' : 'Мәзірді ашу'}
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
        aria-label="Мобильді навигация"
        aria-hidden={!open}
        inert={!open}
        data-open={open}
        className="ln-sheet absolute inset-x-0 top-full border-b border-ln-border-soft bg-ln-bg lg:hidden"
      >
        <Container className="flex flex-col gap-1 py-4">
          {NAV.map((n) => (
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
          <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
            {cabinet ? (
              <PrimaryButton to={cabinet} className="col-span-2">
                Кабинетке өту
              </PrimaryButton>
            ) : (
              <>
                <SecondaryButton to="/login" cta="mobile_menu">
                  Жүйеге кіру
                </SecondaryButton>
                <PrimaryButton to="/register" cta="mobile_menu">
                  Тегін бастау
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
  return (
    <section aria-labelledby="hero-h" className="relative isolate overflow-hidden pt-16 pb-16 md:pt-24 md:pb-24">
      {/* Бренд-цвет живёт в слое контента: один мягкий свет за макетом, без цветных пятен вокруг заголовка */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[70%]"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 100%, color-mix(in srgb, var(--ln-brand) 18%, transparent) 0%, transparent 70%), linear-gradient(180deg, var(--ln-bg) 0%, var(--ln-soft) 100%)',
        }}
      />
      <Container>
        <Reveal className="mx-auto max-w-4xl text-center">
          <p className="m-0 mb-6 text-[1.0625rem] leading-6 font-medium text-pretty text-ln-accent md:text-[1.1875rem] md:leading-7">
            Қазақстандағы оқу ұйымдары мен компанияларға арналған LMS
          </p>
          <h1
            id="hero-h"
            className="m-0 text-[2.5rem] leading-[2.875rem] font-semibold tracking-[-0.035em] text-balance text-ln-ink sm:text-[3.75rem] sm:leading-[4rem] lg:text-[4.75rem] lg:leading-[5rem]"
          >
            Оқу процесін бір жүйеде басқарыңыз
          </h1>
          <p className="m-0 mx-auto mt-7 max-w-2xl text-[1.1875rem] leading-[1.875rem] text-pretty text-ln-ink-2 md:text-[1.3125rem] md:leading-8">
            Курстарды құрыңыз, білім алушыларды топтарға қосыңыз, тапсырмаларды бағалаңыз және оқу нәтижесін нақты уақытта бақылаңыз.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <PrimaryButton to="/register" size="lg" cta="hero">
              Тегін бастау <ArrowRight size={18} aria-hidden />
            </PrimaryButton>
            <SecondaryButton href="#preview" size="lg" cta="hero">
              Демо көру
            </SecondaryButton>
          </div>
          <p className="m-0 mt-5 text-[0.9375rem] leading-6 text-ln-muted">Бастауға банк картасы қажет емес · Баптауға көмектесеміз</p>
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
  if (STATS.length) {
    return (
      <Section labelledBy="trust-h" className="py-16! md:py-20!">
        <Container>
          <SectionHeading id="trust-h" title={`${BRAND} нақты сандармен`} />
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
        <p className="m-0 text-[1.0625rem] font-medium text-ln-ink">Оқу орталықтары, мектептер және компаниялар үшін жасалған</p>
        <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0" aria-label="Кімдер қолданады">
          {['Оқу орталықтары', 'Мектептер мен колледждер', 'ЖОО', 'HR және L&D'].map((t) => (
            <li key={t} className="rounded-full bg-ln-soft px-3.5 py-1.5 text-[0.9375rem] text-ln-ink-2">
              {t}
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}

/** Логотипы клиентов: публикуются только с письменного разрешения; на мобильном — горизонтальная прокрутка. */
function ClientLogos() {
  if (!CLIENT_LOGOS.length) return null;
  return (
    <Section labelledBy="logos-h" className="py-16! md:py-20!">
      <Container>
        <h2 id="logos-h" className="m-0 text-center text-[1.25rem] font-semibold text-ln-ink">
          {BRAND}-ді таңдаған ұйымдар
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

const GAINS = [
  'Барлық оқу материалы бір жерде',
  'Тапсырмалар мен бағалар жоғалмайды',
  'Оқу прогресі нақты уақытта көрінеді',
  'Әр пайдаланушыға жеке рөл мен қолжетімділік беріледі',
];

function Problem() {
  return (
    <Section labelledBy="problem-h" className="bg-ln-soft">
      <Container>
        <SectionHeading
          id="problem-h"
          title="Бірнеше жүйенің орнына — бір платформа"
          text={`Оқу материалдары бөлек, тапсырмалар мессенджерде, кесте басқа сервисте, ал есептер Excel-де сақтала ма? ${BRAND} курстарды, топтарды, тапсырмаларды, бағалауды және нәтижелерді бір ортада біріктіреді.`}
        />
        <Reveal className="mt-12 md:mt-16">
          <BeforeAfter />
        </Reveal>
        <ul className="m-0 mt-10 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {GAINS.map((g) => (
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

/* ---------------- Features bento ---------------- */

/** Плитка без рамки: поверхность отделяется только тоном фона и радиусом. */
function FeatureCard({
  icon: Icon,
  title,
  text,
  className = '',
  children,
  delay = 0,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  className?: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  return (
    <Reveal className={className} delay={delay}>
      <article className="flex h-full flex-col rounded-[28px] bg-ln-soft p-7 md:p-9">
        <Icon size={28} strokeWidth={1.75} className="text-ln-ink-2" aria-hidden />
        <h3 className="m-0 mt-6 text-[1.375rem] leading-7 font-semibold tracking-[-0.02em] text-ln-ink md:text-[1.625rem] md:leading-8">{title}</h3>
        <p className="m-0 mt-3 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{text}</p>
        {children && <div className="mt-8 flex-1">{children}</div>}
      </article>
    </Reveal>
  );
}

/** Мини-превью интерфейса внутри карточки: только сущности и термины реального продукта. */
function Chips({ items }: { items: string[] }) {
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

function Features() {
  return (
    <Section id="features" labelledBy="features-h">
      <Container>
        <SectionHeading
          id="features-h"
          title="Оқу процесінің бәрі — бір жерде"
          text="Курс құрудан бастап нәтижелерді талдауға дейін — әр қадам бір өнімде."
        />
        <div className="mt-14 grid gap-4 md:mt-20 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <FeatureCard
            className="md:col-span-2"
            icon={BookOpen}
            title="Курсты бір құрылымда жинаңыз"
            text="Модульдер, күндер мен элементтер: бейне, файлдар, тесттер және SCORM-пакеттер."
          >
            <CourseBuilderMockup />
          </FeatureCard>
          <FeatureCard
            icon={CalendarDays}
            title="Топтар мен кесте тәртіпте"
            text="Қатысушыларды топтарға қосыңыз, оқу мерзімдері мен іс-шараларды белгілеңіз."
            delay={60}
          >
            <Chips items={['Топ · 24 адам', '01.12 — 28.12', 'Вебинар']} />
          </FeatureCard>
          <FeatureCard
            icon={ClipboardCheck}
            title="Тапсырмалар тексеріліп, жауапсыз қалмайды"
            text="Жауаптарды қабылдаңыз, тексеріңіз және кері байланыс жазыңыз."
          >
            <Chips items={['Тексерілді', 'Күтуде', 'Кері байланыс']} />
          </FeatureCard>
          <FeatureCard
            icon={Award}
            title="Нәтиже мен құжат автоматты"
            text="Бағалар жиналады, курсты аяқтағанда сертификат қалыптасады."
            delay={60}
          >
            <Chips items={['Балл: 92/100', 'Сертификат']} />
          </FeatureCard>
          <FeatureCard
            icon={MessageSquare}
            title="Ешкім мерзімді өткізбейді"
            text="Хабарламалар мен еске салулар білім алушыларды оқу ырғағында ұстайды."
            delay={120}
          >
            <Chips items={['Ертең, 18:00 дейін', 'Жаңа сабақ']} />
          </FeatureCard>
          <FeatureCard
            className="md:col-span-2 lg:col-span-3"
            icon={BarChart3}
            title="Оқу барысы бірден көрінеді"
            text="Қатысу, прогресс, белсенділік және есептер — әр курс пен топ бойынша."
          >
            <Chips items={['Қатысу', 'Прогресс', 'Белсенділік', 'Есептер']} />
          </FeatureCard>
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- How to start ---------------- */

const START_STEPS = [
  { title: 'Ұйымыңызды баптаңыз', text: 'Құрылымды, бөлімдерді, рөлдер мен қолжетімділік құқықтарын орнатыңыз.' },
  { title: 'Курс немесе бағдарлама құрыңыз', text: 'Сабақтарды, бейнелерді, файлдарды, тесттер мен тапсырмаларды қосыңыз.' },
  { title: 'Білім алушыларды шақырыңыз', text: 'Қатысушыларды топтарға бөліп, оқу мерзімі мен кестесін белгілеңіз.' },
  { title: 'Нәтижені бақылаңыз', text: 'Қатысу, прогресс, бағалар және курсты аяқтау көрсеткіштерін көріңіз.' },
];

function HowToStart() {
  return (
    <Section id="how" labelledBy="how-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="how-h" title={`${BRAND}-мен жұмысты бастау оңай`} text="Төрт қадам — және алғашқы топ оқуды бастайды." />
        <Reveal as="ol" className="m-0 mt-14 grid list-none gap-4 p-0 sm:grid-cols-2 md:mt-20 lg:grid-cols-4 lg:gap-5">
          {START_STEPS.map((s, i) => (
            <li key={s.title} className="flex h-full flex-col rounded-[28px] bg-ln-bg p-7">
              <span className="tabular flex h-11 w-11 items-center justify-center rounded-full bg-ln-brand-soft text-[1.0625rem] font-semibold text-ln-accent" aria-hidden>
                {i + 1}
              </span>
              <h3 className="m-0 mt-6 text-[1.25rem] leading-[1.625rem] font-semibold tracking-[-0.015em] text-ln-ink">
                <span className="sr-only">{i + 1}-қадам: </span>
                {s.title}
              </h3>
              <p className="m-0 mt-2 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{s.text}</p>
            </li>
          ))}
        </Reveal>
        <div className="mt-10 flex justify-center">
          <PrimaryButton to="/register" size="lg" cta="how_to_start" className="w-full sm:w-auto">
            Алғашқы курсты құру <ArrowRight size={18} aria-hidden />
          </PrimaryButton>
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Learning path ---------------- */

const STEPS = ['Курсқа қосылады', 'Материалды оқиды', 'Тапсырма орындайды', 'Кері байланыс алады', 'Нәтижесін көреді', 'Сертификат алады'];

/** Текущий шаг в демонстрации: три пройдены, четвёртый — «сіз осындасыз». */
const CURRENT_STEP = 3;

/**
 * Фирменный элемент страницы: путь обучения как трек прогресса —
 * то, что слушатель видит в продукте. Цвет бренда здесь — статус, а не декор.
 */
function LearningPath() {
  return (
    <Section id="learning" labelledBy="learning-h">
      <Container>
        <SectionHeading id="learning-h" title="Оқу жолы" text="Білім алушы қай қадамда тұрғанын әрқашан көреді." />
        <Reveal className="mt-14 md:mt-20">
          <ol className="m-0 grid list-none gap-6 p-0 lg:grid-cols-6 lg:gap-4">
            {STEPS.map((s, i) => {
              const done = i < CURRENT_STEP;
              const current = i === CURRENT_STEP;
              return (
                <li key={s} className="relative flex items-center gap-4 lg:flex-col lg:items-center lg:text-center">
                  {i < STEPS.length - 1 && (
                    <span
                      className="absolute top-12 left-[23px] h-[calc(100%-24px)] w-[2px] overflow-hidden rounded-full bg-ln-border lg:top-[23px] lg:left-[calc(50%+28px)] lg:h-[2px] lg:w-[calc(100%-40px)]"
                      aria-hidden
                    >
                      {done && <span className="ln-seg-fill absolute inset-0 bg-ln-brand" style={{ transitionDelay: `${200 + i * 140}ms` }} />}
                    </span>
                  )}
                  <span
                    className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[1.0625rem] font-semibold ${
                      done
                        ? 'bg-ln-brand text-white'
                        : current
                          ? 'bg-ln-bg text-ln-accent ring-2 ring-ln-brand ring-offset-4 ring-offset-ln-bg'
                          : 'bg-ln-bg text-ln-muted ring-1 ring-ln-border'
                    }`}
                    aria-hidden
                  >
                    {done ? <Check size={20} strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span className="flex flex-col gap-1 lg:items-center">
                    <span className={`text-[1.0625rem] leading-6 font-medium ${done || current ? 'text-ln-ink' : 'text-ln-ink-2'}`}>
                      <span className="sr-only">
                        {i + 1}-қадам{done ? ', аяқталды' : current ? ', ағымдағы қадам' : ''}:{' '}
                      </span>
                      {s}
                    </span>
                    {current && (
                      <span
                        className="self-start rounded-full bg-ln-brand-soft px-2.5 py-0.5 text-[0.8125rem] font-medium tracking-[0.01em] text-ln-accent lg:self-center"
                        aria-hidden
                      >
                        Сіз осындасыз
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Roles: admin, teacher, learner ---------------- */

const ADMIN: { icon: LucideIcon; label: string }[] = [
  { icon: Landmark, label: 'Ұйым құрылымы мен бөлімдер' },
  { icon: Users, label: 'Пайдаланушылар мен топтар' },
  { icon: KeyRound, label: 'Рөлдер мен рұқсаттар' },
  { icon: FileStack, label: 'Тариф пен лимиттер' },
];

function Admin() {
  return (
    <Section id="roles" labelledBy="admin-h" className="bg-ln-soft">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            id="admin-h"
            align="left"
            eyebrow="Әкімшіге"
            title="Әкімшіге — бүкіл ұйым бір кабинетте"
            text="Ұйым құрылымын, пайдаланушыларды, тарифті, рөлдерді және оқу көрсеткіштерін басқарыңыз."
          />
          <ul className="m-0 mt-10 grid list-none gap-x-8 p-0 sm:grid-cols-2">
            {ADMIN.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 border-b border-ln-border py-4 text-[1.0625rem] text-ln-ink">
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-ln-ink-2" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <Reveal variant="scale">
          <AdminMockup />
        </Reveal>
      </Container>
    </Section>
  );
}

const TEACHER: { icon: LucideIcon; label: string }[] = [
  { icon: Plus, label: 'Курсты жылдам құру' },
  { icon: Upload, label: 'Материал қосу' },
  { icon: ClipboardCheck, label: 'Тапсырма беру' },
  { icon: SquareCheckBig, label: 'Тексеру және бағалау' },
  { icon: BarChart3, label: 'Топ прогресін бақылау' },
  { icon: MessageSquare, label: 'Хабарлама жіберу' },
];

function Teacher() {
  return (
    <Section labelledBy="teacher-h">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal variant="scale" className="order-2 lg:order-1">
          <TeacherMockup />
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeading
            id="teacher-h"
            align="left"
            eyebrow="Оқытушыға"
            title="Оқытушыға — қарапайым жұмыс ортасы"
            text="Курс құрыңыз, материал қосыңыз, тапсырмаларды тексеріңіз және топ прогресін бақылаңыз."
          />
          <ul className="m-0 mt-10 grid list-none gap-x-8 p-0 sm:grid-cols-2">
            {TEACHER.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 border-b border-ln-border py-4 text-[1.0625rem] text-ln-ink">
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-ln-ink-2" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}

function Learner() {
  return (
    <Section labelledBy="learner-h" className="bg-ln-soft">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <SectionHeading
          id="learner-h"
          align="left"
          eyebrow="Білім алушыға"
          title="Білім алушыға — бәрі түсінікті"
          text="Сабақтарды өтіңіз, тапсырмаларды орындаңыз және нәтижелеріңізді бір экраннан көріңіз — компьютерде де, телефонда да."
        />
        <Reveal variant="scale">
          <LearnerMockup />
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Analytics ---------------- */

const METRICS = [
  { label: 'Курсты аяқтау деңгейі', value: '86%' },
  { label: 'Белсенді білім алушылар', value: '1 248' },
  { label: 'Орташа балл', value: '82%' },
  { label: 'Аяқталған курстар', value: '3 760' },
];

function Analytics() {
  const bars = [52, 61, 58, 70, 74, 69, 81, 86];
  return (
    <Section id="analytics" labelledBy="analytics-h">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading
            id="analytics-h"
            align="left"
            title="Дерекке сүйеніп шешім қабылдаңыз"
            text="Қай курс жақсы нәтиже беріп жатқанын, кімге қосымша қолдау қажет екенін және оқу процесі қалай жүріп жатқанын бірден көріңіз."
          />
          <div className="mt-8">
            <SecondaryButton to="/login" cta="analytics">
              Есептерді көру <ArrowRight size={16} aria-hidden />
            </SecondaryButton>
          </div>
        </div>
        <Reveal variant="scale">
          <div className="ln-shadow rounded-[28px] border border-ln-border-soft bg-ln-bg p-5 md:p-7">
            {/* Фильтры — часть макета, не элементы управления */}
            <div className="mb-3 flex flex-wrap gap-2" aria-hidden>
              {['Курс: барлығы', 'Топ: барлығы', 'Кезең: 8 апта'].map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full border border-ln-border-soft px-3 py-1 text-[0.8125rem] text-ln-ink-2">
                  {f} <ChevronDown size={14} />
                </span>
              ))}
            </div>
            <dl className="m-0 grid grid-cols-2 gap-3">
              {METRICS.map((m) => (
                <div key={m.label} className="rounded-2xl bg-ln-soft p-4 md:p-5">
                  <dt className="text-[0.8125rem] leading-[1.125rem] tracking-[0.01em] text-ln-muted">{m.label}</dt>
                  <dd className="tabular m-0 mt-2 text-[1.75rem] leading-8 font-semibold tracking-[-0.02em] text-ln-ink md:text-[2.125rem] md:leading-10">
                    {m.value}
                  </dd>
                </div>
              ))}
            </dl>
            <div
              className="mt-3 rounded-2xl bg-ln-soft p-4 md:p-5"
              role="img"
              aria-label="Демонстрациялық деректер: соңғы 8 аптада курсты аяқтау деңгейі 52%-дан 86%-ға дейін өсті"
            >
              <p className="m-0 mb-4 text-[0.9375rem] font-medium text-ln-ink">Аяқтау деңгейі, апта бойынша</p>
              <div className="flex h-28 items-end gap-2" aria-hidden>
                {bars.map((b, i) => (
                  <div key={i} className="flex-1 rounded-md bg-ln-brand" style={{ height: `${b}%`, opacity: 0.35 + (i / bars.length) * 0.65 }} />
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
  if (!CASES.length) return null;
  return (
    <Section id="cases" labelledBy="cases-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="cases-h" title={`${BRAND} ұйымдарға қандай нәтиже береді`} />
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
                Кейсті толық оқу <ArrowRight size={16} aria-hidden />
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

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  ready: 'Дайын интеграция',
  api: 'API арқылы',
  planned: 'Жоспарда',
};

/** Только честные статусы: запланированное не выдаётся за доступное. */
const INTEGRATIONS: { name: string; text: string; icon: LucideIcon; status: IntegrationStatus }[] = [
  { name: 'SCORM', text: 'Дайын электронды курстарды жүктеу', icon: LibraryBig, status: 'ready' },
  { name: 'Вебинарлар', text: 'Онлайн-сабақтар платформа ішінде', icon: Presentation, status: 'ready' },
  { name: 'Zoom', text: 'Онлайн-сабақтар мен вебинарлар', icon: Video, status: 'planned' },
  { name: 'Google Workspace', text: 'Құжаттар мен күнтізбе', icon: Cloud, status: 'planned' },
  { name: 'SSO', text: 'Ұйымның есептік жазбасымен кіру', icon: KeyRound, status: 'planned' },
  { name: 'Ашық API', text: 'Өз жүйелеріңізбен байланыс', icon: Code2, status: 'planned' },
];

function Integrations() {
  return (
    <Section id="integrations" labelledBy="integrations-h" className="bg-ln-soft">
      <Container>
        <SectionHeading
          id="integrations-h"
          title="Қолданыстағы жүйелермен бірге жұмыс істейді"
          text="Әр интеграцияның ағымдағы күйі көрсетілген — жоспардағысын дайын деп ұсынбаймыз."
        />
        <Reveal>
          <ul className="m-0 mt-14 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:mt-20 lg:grid-cols-3 lg:gap-5">
            {INTEGRATIONS.map(({ name, text, icon: Icon, status }) => (
              <li key={name} className="flex h-full items-center gap-4 rounded-[22px] bg-ln-bg p-5 md:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-ln-soft text-ln-ink-2">
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[1.0625rem] font-semibold text-ln-ink">{name}</p>
                  <p className="m-0 mt-0.5 text-[0.9375rem] text-ln-muted">{text}</p>
                  <p
                    className={`m-0 mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[0.8125rem] font-medium ${
                      status === 'planned' ? 'bg-ln-subtle text-ln-ink-2' : 'bg-ln-success-soft text-ln-success'
                    }`}
                  >
                    {STATUS_LABEL[status]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}

/** Проверяемые формулировки: без сертификаций, уровней шифрования, SLA и места хранения без документов. */
const SECURITY: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: 'Рөлдер мен қолжетімділік құқықтары' },
  { icon: Landmark, label: 'Әр ұйымның деректері бөлек' },
  { icon: LockKeyhole, label: 'Жеке есептік жазба арқылы кіру' },
  { icon: History, label: 'Әрекеттер журналы' },
];

function Security() {
  return (
    <Section labelledBy="security-h">
      <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <Reveal>
            <ShieldCheck size={44} strokeWidth={1.5} className="text-ln-ink" aria-hidden />
          </Reveal>
          <div className="mt-6">
            <SectionHeading
              id="security-h"
              align="left"
              title="Деректерге тек рұқсаты барлар қол жеткізеді"
              text="Әр пайдаланушы өз рөліне қажетті бөлімдерді ғана көреді, ал маңызды әрекеттер журналда сақталады."
            />
          </div>
        </div>
        {/* Сгруппированный список: одна поверхность, строки разделены линиями с отступом */}
        <Reveal>
          <ul className="m-0 list-none overflow-hidden rounded-[22px] bg-ln-soft p-0">
            {SECURITY.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4 pl-5 [&:last-child>span]:border-b-0">
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-ln-ink-2" aria-hidden />
                <span className="flex flex-1 items-center gap-4 border-b border-ln-border-soft py-4 pr-5 text-[1.0625rem] text-ln-ink">
                  <span className="flex-1">{label}</span>
                  <Check size={20} strokeWidth={2.25} className="shrink-0 text-ln-success" aria-label="бар" />
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Onboarding & support ---------------- */

const SUPPORT = [
  'Алғашқы баптау бойынша кеңес',
  'Қызметкерлерге арналған таныстыру',
  'Материалдарды көшіруге көмек',
  'Техникалық қолдау',
  'Білім базасы мен нұсқаулықтар',
];

function Support() {
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
              title="Іске қосу кезінде жалғыз қалмайсыз"
              text="Командамыз платформаны баптауға, оқу материалдарын орналастыруға және қызметкерлерді жаңа жүйемен жұмыс істеуге дайындауға көмектеседі."
            />
          </div>
          <div className="mt-8">
            <PrimaryButton href="#demo" size="lg" cta="support" className="w-full sm:w-auto">
              Енгізу туралы кеңес алу
            </PrimaryButton>
          </div>
        </div>
        <Reveal>
          <ul className="m-0 list-none overflow-hidden rounded-[22px] bg-ln-bg p-0">
            {SUPPORT.map((label) => (
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

const AUDIENCES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BookOpen, title: 'Оқу орталықтарына', text: 'Курстар, топтар, кесте және нәтижелер бір жүйеде.' },
  { icon: School, title: 'Мектептер мен колледждерге', text: 'Сабақ материалдары, үй тапсырмалары және оқушылар прогресі.' },
  { icon: Briefcase, title: 'HR және L&D командаларына', text: 'Қызметкерлерді оқыту, бейімдеу және біліктілікті арттыру.' },
  { icon: Landmark, title: 'ЖОО мен білім беру ұйымдарына', text: 'Бағдарламалар, бөлімдер және ауқымды аналитика.' },
  { icon: UsersRound, title: 'Тренерлер мен курс авторларына', text: 'Өз курстарыңызды құрып, топтарды бір жерден жүргізіңіз.' },
];

function Audience() {
  return (
    <Section id="audience" labelledBy="audience-h">
      <Container>
        <SectionHeading id="audience-h" title="Бір курсқа да, үлкен ұйымға да" text={`${BRAND} оқытумен айналысатын кез келген командаға арналған.`} />
        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-6 lg:gap-5">
          {AUDIENCES.map(({ icon: Icon, title, text }, i) => (
            <article key={title} className={`flex h-full flex-col rounded-[28px] bg-ln-soft p-7 lg:col-span-2 ${i >= 3 ? 'lg:col-span-3' : ''}`}>
              <Icon size={28} strokeWidth={1.75} className="text-ln-ink-2" aria-hidden />
              <h3 className="m-0 mt-6 text-[1.25rem] leading-[1.625rem] font-semibold tracking-[-0.015em] text-ln-ink">{title}</h3>
              <p className="m-0 mt-2 text-[1.0625rem] leading-[1.625rem] text-ln-ink-2">{text}</p>
            </article>
          ))}
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
  return (
    <Section id="pricing" labelledBy="pricing-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="pricing-h" title="Сізге сай жоспарды таңдаңыз" text="Бағалар ұйым үшін, ай сайынғы төлеммен көрсетілген." />
        <div className="mt-14 grid items-stretch gap-4 md:mt-20 lg:grid-cols-3 lg:gap-5">
          {PLANS.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <article
                className={`relative flex h-full flex-col rounded-[28px] bg-ln-bg p-7 md:p-8 ${p.popular ? 'ln-shadow ring-2 ring-ln-brand' : ''}`}
                aria-label={`${p.name} тарифі${p.popular ? ', ұсынылады' : ''}`}
              >
                {p.popular && (
                  <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-ln-brand px-3 py-1 text-[0.8125rem] leading-5 font-medium tracking-[0.01em] whitespace-nowrap text-white">
                    <Star size={12} fill="currentColor" aria-hidden /> Ұсынылады
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
                  <PrimaryButton to={`/register?plan=${p.id}`} size="lg" className="mt-8 w-full" onClick={() => selectPlan(p.id, 'month')}>
                    Тегін бастау
                  </PrimaryButton>
                ) : (
                  <SecondaryButton to={`/register?plan=${p.id}`} size="lg" className="mt-8 w-full" onClick={() => selectPlan(p.id, 'month')}>
                    Бастау
                  </SecondaryButton>
                )}
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-4 lg:mt-5">
          <article
            aria-label="Ұйым тарифі"
            className="flex flex-col gap-5 rounded-[28px] bg-ln-bg p-7 md:flex-row md:items-center md:justify-between md:p-8"
          >
            <div>
              <h3 className="m-0 text-[1.375rem] leading-7 font-semibold tracking-[-0.015em] text-ln-ink">Ұйым</h3>
              <p className="m-0 mt-1 text-[0.9375rem] leading-6 text-ln-muted">
                Корпорациялар мен ЖОО-ларға: шектеусіз білім алушылар, жеке шарттар. <b className="font-semibold text-ln-ink">Келісімшарт бойынша</b>
              </p>
            </div>
            <SecondaryButton href="#demo" size="lg" className="w-full md:w-auto" cta="pricing_enterprise" onClick={() => selectPlan('enterprise', 'contract')}>
              Демо сұрау
            </SecondaryButton>
          </article>
        </Reveal>
        <details className="group mt-8 rounded-[22px] bg-ln-bg">
          <summary className="ln-focus flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-[22px] px-6 py-4 text-[1.0625rem] font-medium text-ln-ink">
            Тарифтерді толық салыстыру
            <ChevronDown size={20} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full min-w-[520px] border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr>
                  <th scope="col" className="border-b border-ln-border py-3 pr-4 font-medium text-ln-muted">
                    Мүмкіндік
                  </th>
                  {PLANS.map((p) => (
                    <th key={p.id} scope="col" className="border-b border-ln-border px-3 py-3 font-semibold text-ln-ink">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_COMPARISON.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="border-b border-ln-border-soft py-3 pr-4 font-normal text-ln-ink-2">
                      {row.label}
                    </th>
                    {row.values.map((v, i) => (
                      <td key={i} className="tabular border-b border-ln-border-soft px-3 py-3 text-ln-ink">
                        {v === '✓' ? <Check size={18} strokeWidth={2.25} className="text-ln-success" aria-label="бар" /> : v === '—' ? <span aria-label="жоқ">—</span> : v}
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
        <SectionHeading id="faq-h" title="Жиі қойылатын сұрақтар" />
        <div className="mt-12 divide-y divide-ln-border border-y border-ln-border md:mt-16">
          {FAQ.map((f) => {
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
  return (
    <section aria-labelledby="cta-h" className="bg-ln-inverse py-20 md:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <Reveal className="text-center lg:text-left">
          <h2 id="cta-h" className="m-0 text-[2rem] leading-[2.375rem] font-semibold tracking-[-0.03em] text-balance text-white md:text-5xl md:leading-[3.375rem]">
            Оқу процесін бір жүйеге біріктіруге дайынсыз ба?
          </h2>
          <p className="m-0 mt-5 text-[1.1875rem] leading-[1.875rem] text-white/80">
            {BRAND} мүмкіндіктерін демода көріңіз немесе алғашқы курсыңызды бүгін құрыңыз.
          </p>
          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <PrimaryButton to="/register" size="lg" cta="final_cta">
              Тегін бастау
            </PrimaryButton>
            <a
              href="#demo"
              data-cta="final_cta"
              className="ln-focus ln-press inline-flex h-12 items-center justify-center rounded-full bg-white/10 px-6 text-[1.0625rem] font-medium text-white! no-underline transition-colors hover:bg-white/20 hover:text-white!"
            >
              Жеке демо сұрау
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

const FOOTER: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Өнім',
    links: [
      { label: 'Мүмкіндіктер', href: '#features' },
      { label: 'Қалай жұмыс істейді', href: '#how' },
      { label: 'Интеграциялар', href: '#integrations' },
      { label: 'Тарифтер', href: '#pricing' },
      { label: 'Сұрақтар', href: '#faq' },
    ],
  },
  {
    title: 'Байланыс',
    links: [
      { label: `Қолдау: ${SUPPORT_EMAIL}`, href: `mailto:${SUPPORT_EMAIL}` },
      { label: `Сату бөлімі: ${SALES_EMAIL}`, href: `mailto:${SALES_EMAIL}` },
      { label: 'Демо сұрау', href: '#demo' },
    ],
  },
  {
    title: 'Құжаттар',
    links: [
      { label: 'Құпиялық саясаты', href: '#top' },
      { label: 'Пайдалану шарттары', href: '#top' },
      { label: 'Жария оферта', href: '#top' },
    ],
  },
];

function Footer() {
  return (
    <footer className="bg-ln-soft pt-12 pb-8 md:pt-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <BrandLogo />
            <p className="m-0 mt-4 max-w-xs text-[0.9375rem] leading-6 text-ln-ink-2">Оқу процесін басқаруға арналған платформа.</p>
          </div>
          {/* Desktop: колонки */}
          {FOOTER.map((col) => (
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
            {FOOTER.map((col) => (
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
        <div className="mt-12 flex flex-col gap-2 border-t border-ln-border pt-6 text-[0.8125rem] tracking-[0.01em] text-ln-muted sm:flex-row sm:justify-between">
          <p className="m-0">
            © {new Date().getFullYear()} {BRAND}. Барлық құқықтар қорғалған.
          </p>
          <p className="m-0">Әзірлеген: CPM NIS</p>
        </div>
      </Container>
    </footer>
  );
}

/* ---------------- SEO ---------------- */

const SEO = {
  title: `${BRAND} — оқу процесін басқаруға арналған платформа`,
  description: `Курстарды құрыңыз, білім алушыларды басқарыңыз, тапсырмаларды бағалаңыз және оқу нәтижесін ${BRAND} платформасында бақылаңыз.`,
};

/** Метатеги страницы: title, description, canonical, Open Graph и FAQPage (ответы видимы на странице). При уходе — восстанавливаются. */
function useLandingMeta() {
  useEffect(() => {
    const html = document.documentElement;
    const prevLang = html.lang;
    const prevTitle = document.title;
    html.lang = 'kk';
    html.style.scrollBehavior = 'smooth';
    document.title = SEO.title;

    const url = `${window.location.origin}/`;
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
    meta('name', 'description', SEO.description);
    meta('property', 'og:type', 'website');
    meta('property', 'og:title', SEO.title);
    meta('property', 'og:description', SEO.description);
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
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
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
  }, []);
}

/* ---------------- Page ---------------- */

export function LandingPage() {
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
      className="ln-root min-h-screen overflow-x-clip antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, "Segoe UI", sans-serif' }}
      onClick={onClick}
    >
      <a
        href="#main"
        className="ln-focus sr-only rounded-lg bg-ln-brand! px-4 py-2 text-white! focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Негізгі мазмұнға өту
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Trust />
        <ClientLogos />
        <Problem />
        <Features />
        <HowToStart />
        <LearningPath />
        <Admin />
        <Teacher />
        <Learner />
        <Analytics />
        <Cases />
        <Integrations />
        <Security />
        <Support />
        <Audience />
        <Pricing />
        <Faq />
        <FinalCta demo={demo} />
      </main>
      <Footer />
    </div>
  );
}
