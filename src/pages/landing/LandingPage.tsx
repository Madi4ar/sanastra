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
  Cloud,
  Code2,
  DatabaseBackup,
  FileLock2,
  GraduationCap,
  History,
  KeyRound,
  Landmark,
  LockKeyhole,
  Menu,
  MessageSquare,
  Plus,
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
import { useEffect, useState } from 'react';
import { useCurrentUser, homeFor } from '@/auth/auth';
import { DashboardMockup, LearnerMockup, PhoneScreens, TeacherMockup } from './mockups';
import { Container, GhostButton, PrimaryButton, Reveal, SanastraLogo, Section, SectionHeading, SecondaryButton } from './primitives';

const NAV = [
  { href: '#features', label: 'Мүмкіндіктер' },
  { href: '#learning', label: 'Оқу' },
  { href: '#analytics', label: 'Аналитика' },
  { href: '#organizations', label: 'Ұйымдарға' },
  { href: '#pricing', label: 'Бағалар' },
];

/* ---------------- Header ---------------- */

function Header() {
  const [open, setOpen] = useState(false);
  const { data: user } = useCurrentUser();
  const cabinet = user ? homeFor(user) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="ln-glass sticky top-0 z-40 border-b border-ln-border-soft">
      <Container className="flex h-16 items-center gap-6">
        <SanastraLogo />
        <nav aria-label="Негізгі навигация" className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="ln-focus rounded-full px-3.5 py-2 text-[15px] text-ln-ink-2! no-underline transition-colors hover:text-ln-ink!"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {cabinet ? (
            <PrimaryButton to={cabinet}>Кабинетке өту</PrimaryButton>
          ) : (
            <>
              <GhostButton to="/login">Кіру</GhostButton>
              <PrimaryButton to="/login">Бастау</PrimaryButton>
            </>
          )}
        </div>
        <button
          type="button"
          className="ln-focus ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ln-ink hover:bg-ln-subtle sm:ml-0 lg:hidden"
          aria-label={open ? 'Мәзірді жабу' : 'Мәзірді ашу'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </Container>
      {open && (
        <nav id="mobile-nav" aria-label="Мобильді навигация" className="border-t border-ln-border-soft lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="ln-focus rounded-xl px-3 py-3 text-[17px] font-medium text-ln-ink! no-underline hover:bg-ln-subtle hover:text-ln-ink!"
              >
                {n.label}
              </a>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
              <SecondaryButton to="/login">Кіру</SecondaryButton>
              <PrimaryButton to="/login">Бастау</PrimaryButton>
            </div>
          </Container>
        </nav>
      )}
    </header>
  );
}

/* ---------------- Hero + Product preview ---------------- */

function Hero() {
  return (
    <section aria-labelledby="hero-h" className="relative isolate overflow-hidden pt-20 pb-20 md:pt-28 md:pb-28">
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
          <p className="m-0 mb-6 text-[17px] leading-6 font-medium text-pretty text-ln-accent md:text-[19px] md:leading-7">
            Білімді жандардың сана биігінде жолығуы
          </p>
          <h1
            id="hero-h"
            className="m-0 text-[44px] leading-[48px] font-semibold tracking-[-0.035em] text-ln-ink sm:text-[64px] sm:leading-[68px] lg:text-[88px] lg:leading-[92px]"
          >
            Саналы білім.
            <br />
            <span className="text-ln-muted">Тұрақты даму.</span>
          </h1>
          <p className="m-0 mx-auto mt-7 max-w-2xl text-[19px] leading-[30px] text-pretty text-ln-ink-2 md:text-[21px] md:leading-8">
            Курстарды, тапсырмаларды, бағалауды және оқу нәтижелерін бір платформада басқарыңыз.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton to="/login" size="lg">
              Тегін бастау <ArrowRight size={18} aria-hidden />
            </PrimaryButton>
            <SecondaryButton href="#preview" size="lg">
              Демо көру
            </SecondaryButton>
          </div>
        </Reveal>
        <Reveal variant="scale" className="mx-auto mt-16 max-w-[1080px] scroll-mt-24 md:mt-24" delay={150}>
          <div id="preview">
            <DashboardMockup />
          </div>
        </Reveal>
      </Container>
    </section>
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
        <h3 className="m-0 mt-6 text-[22px] leading-7 font-semibold tracking-[-0.02em] text-ln-ink md:text-[26px] md:leading-8">{title}</h3>
        <p className="m-0 mt-3 text-[17px] leading-[26px] text-ln-ink-2">{text}</p>
        {children && <div className="mt-8 flex-1">{children}</div>}
      </article>
    </Reveal>
  );
}

function Features() {
  return (
    <Section id="features" labelledBy="features-h">
      <Container>
        <SectionHeading
          id="features-h"
          title="Оқу процесінің бәрі — бір жерде"
          text="Sanastra оқу бағдарламаларын құрудан бастап, нәтижелерді талдауға дейінгі барлық процесті біріктіреді."
        />
        <div className="mt-14 grid gap-4 md:mt-20 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <FeatureCard
            className="lg:col-span-2"
            icon={BookOpen}
            title="Курстарды оңай құрыңыз"
            text="Материалдар, сабақтар, тапсырмалар және оқу жолдары бір құрылымда."
          >
            <div className="grid gap-2 sm:grid-cols-3" aria-hidden>
              {[
                ['1-модуль', 'Кіріспе', '4 сабақ'],
                ['2-модуль', 'Негізгі тақырып', '6 сабақ'],
                ['3-модуль', 'Қорытынды жоба', '2 тапсырма'],
              ].map(([m, t, c]) => (
                <div key={m} className="rounded-2xl bg-ln-bg p-4">
                  <p className="m-0 text-xs text-ln-muted">{m}</p>
                  <p className="m-0 mt-1 text-[15px] font-semibold text-ln-ink">{t}</p>
                  <p className="m-0 mt-2 text-[13px] text-ln-ink-2">{c}</p>
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard
            icon={ClipboardCheck}
            title="Тапсырмалар мен бағалау"
            text="Тапсырма беріңіз, жауаптарды қабылдаңыз және нәтижені бір жерден бақылаңыз."
            delay={60}
          />
          <FeatureCard
            icon={BarChart3}
            title="Нақты оқу аналитикасы"
            text="Қатысу, прогресс, нәтижелер және белсенділік бойынша түсінікті көрсеткіштер."
          />
          <FeatureCard
            icon={Award}
            title="Құжаттарды автоматты беру"
            text="Курсты аяқтағаннан кейін сертификаттарды автоматты түрде қалыптастырыңыз."
            delay={60}
          />
          <FeatureCard
            icon={CalendarDays}
            title="Оқу кестесі"
            text="Сабақтар, дедлайндар мен іс-шараларды бір күнтізбеде басқарыңыз."
            delay={120}
          />
          <FeatureCard
            className="md:col-span-2 lg:col-span-3"
            icon={UsersRound}
            title="Командамен бірге жұмыс"
            text="Әкімшілер, тренерлер және білім алушылар үшін жеке рөлдер мен құқықтар."
          >
            <div className="flex flex-wrap gap-2" aria-hidden>
              {['Әкімші', 'Оқытушы', 'Тренер', 'Білім алушы', 'Ата-ана'].map((r) => (
                <span key={r} className="rounded-full bg-ln-bg px-4 py-1.5 text-[15px] text-ln-ink-2">
                  {r}
                </span>
              ))}
            </div>
          </FeatureCard>
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Learning path ---------------- */

const STEPS = [
  'Курсқа қосылады',
  'Материалды оқиды',
  'Тапсырма орындайды',
  'Бағалау алады',
  'Нәтижесін көреді',
  'Сертификат алады',
];

/** Текущий шаг в демонстрации: три пройдены, четвёртый — «сіз осындасыз». */
const CURRENT_STEP = 3;

/**
 * Фирменный элемент страницы: путь обучения как трек прогресса —
 * то, что слушатель видит в продукте. Цвет бренда здесь — статус, а не декор.
 */
function LearningPath() {
  return (
    <Section id="learning" labelledBy="learning-h" className="bg-ln-soft">
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
                      {done && (
                        <span className="ln-seg-fill absolute inset-0 bg-ln-brand" style={{ transitionDelay: `${200 + i * 140}ms` }} />
                      )}
                    </span>
                  )}
                  <span
                    className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold ${
                      done
                        ? 'bg-ln-brand text-white'
                        : current
                          ? 'bg-ln-bg text-ln-accent ring-2 ring-ln-brand ring-offset-4 ring-offset-ln-soft'
                          : 'bg-ln-bg text-ln-muted ring-1 ring-ln-border'
                    }`}
                    aria-hidden
                  >
                    {done ? <Check size={20} strokeWidth={2.5} /> : i + 1}
                  </span>
                  <span className="flex flex-col gap-1 lg:items-center">
                    <span className={`text-[17px] leading-6 font-medium ${done || current ? 'text-ln-ink' : 'text-ln-ink-2'}`}>
                      <span className="sr-only">
                        {i + 1}-қадам{done ? ', аяқталды' : current ? ', ағымдағы қадам' : ''}:{' '}
                      </span>
                      {s}
                    </span>
                    {current && (
                      <span className="self-start rounded-full bg-ln-brand-soft px-2.5 py-0.5 text-[13px] font-medium text-ln-accent lg:self-center" aria-hidden>
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
        <SectionHeading
          id="analytics-h"
          align="left"
          title="Дерекке сүйеніп шешім қабылдаңыз"
          text="Қай курс жақсы нәтиже беріп жатыр, кімге қосымша қолдау қажет және оқу процесі қалай жүріп жатқанын бірден көріңіз."
        />
        <Reveal variant="scale">
          <div className="ln-shadow rounded-[28px] border border-ln-border-soft bg-ln-bg p-5 md:p-7">
            <dl className="m-0 grid grid-cols-2 gap-3">
              {METRICS.map((m) => (
                <div key={m.label} className="rounded-2xl bg-ln-soft p-4 md:p-5">
                  <dt className="text-[13px] leading-[18px] text-ln-muted">{m.label}</dt>
                  <dd className="tabular m-0 mt-2 text-[28px] leading-8 font-semibold tracking-[-0.02em] text-ln-ink md:text-[34px] md:leading-10">{m.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 rounded-2xl bg-ln-soft p-4 md:p-5" role="img" aria-label="Соңғы 8 аптадағы курсты аяқтау деңгейі 52%-дан 86%-ға дейін өсті">
              <p className="m-0 mb-4 text-[15px] font-medium text-ln-ink">Аяқтау деңгейі, апта бойынша</p>
              <div className="flex h-28 items-end gap-2" aria-hidden>
                {bars.map((b, i) => (
                  <div key={i} className="flex-1 rounded-md bg-ln-brand" style={{ height: `${b}%`, opacity: 0.35 + (i / bars.length) * 0.65 }} />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Teacher & Learner ---------------- */

const TEACHER: { icon: LucideIcon; label: string }[] = [
  { icon: Plus, label: 'Курсты жылдам құру' },
  { icon: Upload, label: 'Материал қосу' },
  { icon: ClipboardCheck, label: 'Тапсырма беру' },
  { icon: SquareCheckBig, label: 'Бағалау' },
  { icon: BarChart3, label: 'Прогресті бақылау' },
  { icon: MessageSquare, label: 'Хабарлама жіберу' },
];

function Teacher() {
  return (
    <Section labelledBy="teacher-h" className="bg-ln-soft">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionHeading id="teacher-h" align="left" eyebrow="Оқытушыға" title="Оқытушыға — қарапайым жұмыс ортасы" />
          <ul className="m-0 mt-10 grid list-none gap-x-8 p-0 sm:grid-cols-2">
            {TEACHER.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 border-b border-ln-border py-4 text-[17px] text-ln-ink">
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-ln-ink-2" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <Reveal variant="scale">
          <TeacherMockup />
        </Reveal>
      </Container>
    </Section>
  );
}

function Learner() {
  return (
    <Section labelledBy="learner-h">
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal variant="scale" className="order-2 lg:order-1">
          <LearnerMockup />
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeading
            id="learner-h"
            align="left"
            eyebrow="Білім алушыға"
            title="Білім алушыға — бәрі түсінікті"
            text="Қай сабақтан өту керек, қандай тапсырма бар, қанша уақыт қалды және нәтиже қандай — барлығы бір экранда."
          />
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Mobile app ---------------- */

function MobileApp() {
  return (
    <Section labelledBy="mobile-h" className="bg-ln-soft">
      <Container>
        <SectionHeading
          id="mobile-h"
          title="Оқу әрқашан жаныңызда"
          text="Сабақтар, тапсырмалар және нәтижелер телефонда да қолжетімді."
        />
        <Reveal variant="scale" className="mt-12 md:mt-16">
          <PhoneScreens />
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Integrations & Security ---------------- */

const INTEGRATIONS: { name: string; text: string; icon: LucideIcon }[] = [
  { name: 'Zoom', text: 'Онлайн-сабақтар мен вебинарлар', icon: Video },
  { name: 'Microsoft Teams', text: 'Командалық кездесулер', icon: Users },
  { name: 'Google Workspace', text: 'Құжаттар мен күнтізбе', icon: Cloud },
  { name: 'Moodle', text: 'Курстарды импорттау', icon: GraduationCap },
  { name: 'API', text: 'Өз жүйелеріңізбен байланыс', icon: Code2 },
  { name: 'SSO', text: 'Бір рет кіру', icon: KeyRound },
];

function Integrations() {
  return (
    <Section id="integrations" labelledBy="integrations-h">
      <Container>
        <SectionHeading id="integrations-h" title="Қолданыстағы жүйелермен бірге жұмыс істейді" />
        <Reveal>
          <ul className="m-0 mt-14 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:mt-20 lg:grid-cols-3 lg:gap-5">
            {INTEGRATIONS.map(({ name, text, icon: Icon }) => (
              <li key={name} className="flex h-full items-center gap-4 rounded-[22px] bg-ln-soft p-5 md:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-ln-bg text-ln-ink-2">
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <p className="m-0 text-[17px] font-semibold text-ln-ink">{name}</p>
                  <p className="m-0 mt-0.5 text-[15px] text-ln-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </Section>
  );
}

const SECURITY: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: 'Рөлдер мен қолжетімділік құқықтары' },
  { icon: LockKeyhole, label: 'Қауіпсіз авторизация' },
  { icon: DatabaseBackup, label: 'Деректерді резервтік көшіру' },
  { icon: History, label: 'Әрекеттер журналы' },
  { icon: FileLock2, label: 'Құпия деректерді қорғау' },
];

function Security() {
  return (
    <Section labelledBy="security-h" className="bg-ln-soft">
      <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <Reveal>
            <ShieldCheck size={44} strokeWidth={1.5} className="text-ln-ink" aria-hidden />
          </Reveal>
          <div className="mt-6">
            <SectionHeading
              id="security-h"
              align="left"
              title="Деректер қауіпсіздігі — басты орында"
              text="Ұйымыңыздың және білім алушылардың деректері сенімді қорғалған."
            />
          </div>
        </div>
        {/* Сгруппированный список: одна поверхность, строки разделены линиями с отступом */}
        <Reveal>
          <ul className="m-0 list-none overflow-hidden rounded-[22px] bg-ln-bg p-0">
            {SECURITY.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-4 pl-5 [&:last-child>span]:border-b-0">
                <Icon size={20} strokeWidth={1.75} className="shrink-0 text-ln-ink-2" aria-hidden />
                <span className="flex flex-1 items-center gap-4 border-b border-ln-border-soft py-4 pr-5 text-[17px] text-ln-ink">
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

/* ---------------- Organizations ---------------- */

const AUDIENCES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: BookOpen, title: 'Оқу орталықтарына', text: 'Курстар, топтар және төлемдерге дейінгі оқу процесі бір жүйеде.' },
  { icon: School, title: 'Мектептерге', text: 'Сабақ кестесі, үй тапсырмалары және оқушылар прогресі.' },
  { icon: Briefcase, title: 'Корпоративтік оқытуға', text: 'Қызметкерлерді оқыту, бейімдеу және біліктілікті арттыру.' },
  { icon: Landmark, title: 'ЖОО мен білім беру ұйымдарына', text: 'Бағдарламалар, факультеттер және ауқымды аналитика.' },
];

function Organizations() {
  return (
    <Section id="organizations" labelledBy="orgs-h">
      <Container>
        <SectionHeading id="orgs-h" title="Бір курсқа да, үлкен ұйымға да" />
        <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 md:mt-20 lg:grid-cols-4 lg:gap-5">
          {AUDIENCES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="flex h-full flex-col rounded-[28px] bg-ln-soft p-7">
              <Icon size={28} strokeWidth={1.75} className="text-ln-ink-2" aria-hidden />
              <h3 className="m-0 mt-6 text-[20px] leading-[26px] font-semibold tracking-[-0.015em] text-ln-ink">{title}</h3>
              <p className="m-0 mt-2 text-[17px] leading-[26px] text-ln-ink-2">{text}</p>
            </article>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}

/* ---------------- Pricing ---------------- */

/** Тарифы: состав совпадает с тарифами в приложении (модули и лимиты). */
const PLANS = [
  {
    name: 'Базалық',
    price: '100 000 ₸',
    period: '/ ай',
    text: 'Шағын оқу орталықтарына',
    features: ['50 білім алушыға дейін', '10 курс', '10 ГБ қойма', 'Курстар мен оқу кестесі', 'Email арқылы қолдау'],
    cta: 'Бастау',
  },
  {
    name: 'Стандарт',
    price: '200 000 ₸',
    period: '/ ай',
    text: 'Мектептер мен оқу орталықтарына',
    features: [
      '100 білім алушыға дейін',
      '50 курс',
      '100 ГБ қойма',
      'Оқу аналитикасы мен есептер',
      'Хабарламалар мен чат',
      'Басым қолдау',
    ],
    cta: 'Тегін бастау',
    popular: true,
  },
  {
    name: 'Бизнес',
    price: '300 000 ₸',
    period: '/ ай',
    text: 'Ірі оқу орталықтарына',
    features: ['1 000 білім алушыға дейін', '500 курс', '1 000 ГБ қойма', 'Вебинарлар мен сертификаттар', 'Барлық модульдер'],
    cta: 'Бастау',
  },
  {
    name: 'Ұйым',
    price: 'Келісімшарт бойынша',
    period: '',
    text: 'Корпорациялар мен ЖОО-ларға',
    features: ['Шектеусіз білім алушылар', 'SSO және API', 'Жеке серверге орналастыру', 'SLA және жеке менеджер', 'Деректерді көшіру'],
    cta: 'Байланысу',
  },
];

function Pricing() {
  return (
    <Section id="pricing" labelledBy="pricing-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="pricing-h" title="Сізге сай жоспарды таңдаңыз" />
        <div className="mt-14 grid items-stretch gap-4 md:mt-20 md:grid-cols-2 lg:gap-5 xl:grid-cols-4">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 60}>
              <article
                className={`relative flex h-full flex-col rounded-[28px] bg-ln-bg p-7 md:p-8 ${p.popular ? 'ln-shadow ring-2 ring-ln-brand' : ''}`}
                aria-label={`${p.name} тарифі${p.popular ? ', жиі таңдалады' : ''}`}
              >
                {p.popular && (
                  <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-ln-brand px-3 py-1 text-[13px] leading-5 font-medium whitespace-nowrap text-white">
                    <Star size={12} fill="currentColor" aria-hidden /> Жиі таңдалады
                  </span>
                )}
                <h3 className="m-0 text-[22px] leading-7 font-semibold tracking-[-0.015em] text-ln-ink">{p.name}</h3>
                {/* Фиксированные высоты: цены и списки на соседних карточках стоят на одной линии */}
                <p className="m-0 mt-1 min-h-12 text-[15px] leading-6 text-ln-muted">{p.text}</p>
                <p className="m-0 mt-4 flex min-h-16 flex-wrap items-end gap-x-1">
                  <span
                    className={`tabular font-semibold tracking-[-0.03em] text-ln-ink ${
                      p.period ? 'text-[36px] leading-[44px]' : 'text-[24px] leading-8'
                    }`}
                  >
                    {p.price}
                  </span>
                  {p.period && <span className="pb-1 text-[17px] text-ln-muted"> {p.period}</span>}
                </p>
                <ul className="m-0 mt-6 flex flex-1 list-none flex-col gap-3 border-t border-ln-border-soft p-0 pt-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[15px] leading-6 text-ln-ink-2">
                      <Check size={18} strokeWidth={2.25} className="mt-0.5 shrink-0 text-ln-ink-2" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.popular ? (
                  <PrimaryButton to="/login" size="lg" className="mt-8 w-full">
                    {p.cta}
                  </PrimaryButton>
                ) : (
                  <SecondaryButton
                    to={p.period ? '/login' : undefined}
                    href={p.period ? undefined : 'mailto:hello@sanastra.kz'}
                    size="lg"
                    className="mt-8 w-full"
                  >
                    {p.cta}
                  </SecondaryButton>
                )}
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCta() {
  return (
    <section aria-labelledby="cta-h" className="bg-ln-inverse py-20 md:py-28 lg:py-36">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 id="cta-h" className="m-0 text-[32px] leading-[38px] font-semibold tracking-[-0.03em] text-balance text-white md:text-5xl md:leading-[54px]">
            Саналы білімге бүгін қадам жасаңыз
          </h2>
          <p className="m-0 mt-5 text-[19px] leading-[30px] text-white/80">Sanastra-мен оқу процесін бір жүйеге біріктіріңіз.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton to="/login" size="lg">
              Sanastra-ны бастау
            </PrimaryButton>
            <a
              href="mailto:hello@sanastra.kz"
              className="ln-focus inline-flex h-12 items-center justify-center rounded-full bg-white/10 px-6 text-[17px] font-medium text-white! no-underline transition-colors hover:bg-white/20 hover:text-white!"
            >
              Демо сұрау
            </a>
          </div>
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
      { label: 'Аналитика', href: '#analytics' },
      { label: 'Интеграциялар', href: '#integrations' },
      { label: 'Бағалар', href: '#pricing' },
    ],
  },
  {
    title: 'Компания',
    links: [
      { label: 'Біз туралы', href: '#top' },
      { label: 'Байланыс', href: 'mailto:hello@sanastra.kz' },
      { label: 'Жаңалықтар', href: '#top' },
    ],
  },
  {
    title: 'Құжаттар',
    links: [
      { label: 'Құпиялық саясаты', href: '#top' },
      { label: 'Пайдалану шарттары', href: '#top' },
      { label: 'Деректерді өңдеу', href: '#top' },
    ],
  },
];

function Footer() {
  return (
    <footer className="bg-ln-soft pt-12 pb-8 md:pt-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <SanastraLogo />
            <p className="m-0 mt-4 max-w-xs text-[15px] leading-6 text-ln-ink-2">Білім беруді басқарудың қарапайым әрі заманауи жолы.</p>
          </div>
          {/* Desktop: колонки */}
          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title} className="hidden md:block">
              <p className="m-0 mb-3 text-[13px] font-semibold text-ln-ink">{col.title}</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="ln-focus inline-block rounded py-1 text-[13px] text-ln-ink-2! no-underline hover:text-ln-ink! hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          {/* Mobile: аккордеон (ТЗ, раздел 27) */}
          <div className="divide-y divide-ln-border border-y border-ln-border md:hidden">
            {FOOTER.map((col) => (
              <details key={col.title} className="group">
                <summary className="ln-focus flex min-h-11 cursor-pointer list-none items-center justify-between py-3 text-[17px] font-medium text-ln-ink">
                  {col.title}
                  <ChevronDown size={18} className="transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="m-0 flex list-none flex-col gap-3 p-0 pb-4">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="ln-focus inline-block rounded py-1 text-[17px] text-ln-ink-2! no-underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
        <p className="m-0 mt-12 border-t border-ln-border pt-6 text-[13px] text-ln-muted">
          © 2026 Sanastra. Барлық құқықтар қорғалған.
        </p>
      </Container>
    </footer>
  );
}

/* ---------------- Page ---------------- */

export function LandingPage() {
  // Публичная страница на казахском: язык документа и заголовок вкладки
  useEffect(() => {
    const html = document.documentElement;
    const prevLang = html.lang;
    const prevTitle = document.title;
    html.lang = 'kk';
    html.style.scrollBehavior = 'smooth';
    document.title = 'Sanastra — Саналы білім, тұрақты даму';
    return () => {
      html.lang = prevLang;
      html.style.scrollBehavior = '';
      document.title = prevTitle;
    };
  }, []);

  return (
    <div
      id="top"
      className="ln-root min-h-screen antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, "Segoe UI", sans-serif' }}
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
        <Features />
        <LearningPath />
        <Analytics />
        <Teacher />
        <Learner />
        <MobileApp />
        <Integrations />
        <Security />
        <Organizations />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
