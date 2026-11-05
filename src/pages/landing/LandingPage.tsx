import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
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
import { Container, PrimaryButton, Reveal, SanastraLogo, Section, SectionHeading, SecondaryButton } from './primitives';

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
    <header
      className="sticky top-0 z-40 border-b border-ln-border-soft backdrop-blur-md"
      style={{ background: 'rgba(255, 255, 255, 0.92)' }}
    >
      <Container className="flex h-[68px] items-center gap-6">
        <SanastraLogo />
        <nav aria-label="Негізгі навигация" className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="ln-focus rounded-md px-3 py-2 text-sm font-medium text-ln-ink-2! no-underline hover:bg-ln-soft hover:text-ln-ink!"
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
              <SecondaryButton to="/login" className="border-transparent">
                Кіру
              </SecondaryButton>
              <PrimaryButton to="/login">Бастау</PrimaryButton>
            </>
          )}
        </div>
        <button
          type="button"
          className="ln-focus ml-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-ln-border bg-ln-bg text-ln-ink sm:ml-0 lg:hidden"
          aria-label={open ? 'Мәзірді жабу' : 'Мәзірді ашу'}
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </Container>
      {open && (
        <nav id="mobile-nav" aria-label="Мобильді навигация" className="border-t border-ln-border-soft bg-ln-bg lg:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="ln-focus rounded-md px-3 py-3 text-base font-medium text-ln-ink! no-underline hover:bg-ln-soft hover:text-ln-ink!"
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
    <section aria-labelledby="hero-h" className="overflow-hidden pt-16 pb-16 md:pt-24 lg:pb-[120px]">
      <Container>
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="m-0 mb-5 inline-flex items-center gap-2 rounded-full border border-ln-border-soft bg-ln-soft px-3 py-1 text-sm font-medium text-ln-ink-2">
            <img src="/brand/sanastra-icon-32.png" width={18} height={18} alt="" className="rounded" />
            Sanastra
          </p>
          <h1
            id="hero-h"
            className="m-0 text-[38px] leading-[44px] font-bold tracking-[-0.03em] text-ln-ink md:text-[56px] md:leading-[64px]"
          >
            Саналы білім.
            <br />
            Тұрақты даму.
          </h1>
          <p className="m-0 mx-auto mt-6 max-w-xl text-lg leading-7 text-ln-ink-2">
            Курстарды, тапсырмаларды, бағалауды және оқу нәтижелерін бір платформада басқарыңыз.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryButton to="/login" size="lg">
              Тегін бастау <ArrowRight size={16} aria-hidden />
            </PrimaryButton>
            <SecondaryButton href="#preview" size="lg">
              Демо көру
            </SecondaryButton>
          </div>
          <p className="m-0 mt-5 text-sm text-ln-muted">Оқу процесін қарапайым, түсінікті және нәтижелі ету үшін жасалған.</p>
        </Reveal>
        <Reveal variant="scale" className="mx-auto mt-14 max-w-[1080px] scroll-mt-24 md:mt-20" delay={120}>
          <div id="preview">
            <DashboardMockup />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- Trust ---------------- */

const ORGS: { name: string; icon: LucideIcon }[] = [
  { name: 'Qazaq Academy', icon: GraduationCap },
  { name: 'Білім орталығы', icon: BookOpen },
  { name: 'Astana Tech College', icon: Building2 },
  { name: 'Daryn School', icon: School },
  { name: 'Orken Learning', icon: Award },
  { name: 'Steppe University', icon: Landmark },
];

function Trust() {
  return (
    <section aria-labelledby="trust-h" className="border-y border-ln-border-soft bg-ln-soft py-12 md:py-14">
      <Container>
        <Reveal>
          <h2 id="trust-h" className="m-0 text-center text-base leading-6 font-medium text-ln-ink-2">
            Білім беру ұйымдарына арналған сенімді цифрлық орта
          </h2>
          <ul className="m-0 mt-8 grid list-none grid-cols-2 gap-x-6 gap-y-6 p-0 sm:grid-cols-3 lg:grid-cols-6">
            {ORGS.map(({ name, icon: Icon }) => (
              <li key={name} className="flex items-center justify-center gap-2 text-ln-muted grayscale">
                <Icon size={20} aria-hidden />
                <span className="text-[15px] font-semibold tracking-tight">{name}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

/* ---------------- Features bento ---------------- */

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
      <article className="ln-card flex h-full flex-col rounded-xl border border-ln-border bg-ln-bg p-6 md:p-7">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ln-brand-soft text-ln-brand">
          <Icon size={20} aria-hidden />
        </span>
        <h3 className="m-0 mt-5 text-xl leading-7 font-semibold text-ln-ink md:text-2xl md:leading-8">{title}</h3>
        <p className="m-0 mt-2 text-base leading-6 text-ln-ink-2">{text}</p>
        {children && <div className="mt-6 flex-1">{children}</div>}
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
        <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
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
                <div key={m} className="rounded-lg border border-ln-border-soft bg-ln-soft p-3">
                  <p className="m-0 text-xs text-ln-muted">{m}</p>
                  <p className="m-0 mt-1 text-sm font-semibold text-ln-ink">{t}</p>
                  <p className="m-0 mt-2 text-xs text-ln-ink-2">{c}</p>
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
                <span key={r} className="rounded-full border border-ln-border-soft bg-ln-soft px-3 py-1 text-sm text-ln-ink-2">
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

function LearningPath() {
  return (
    <Section id="learning" labelledBy="learning-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="learning-h" title="Оқу жолы" text="Білім алушы қай қадамда тұрғанын әрқашан көреді." />
        <ol className="relative m-0 mt-12 grid list-none gap-6 p-0 md:mt-16 lg:grid-cols-6 lg:gap-4">
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s} delay={i * 60} className="relative flex items-center gap-4 lg:flex-col lg:text-center">
              {/* соединительная линия: вертикальная на мобильных, горизонтальная на desktop */}
              {i < STEPS.length - 1 && (
                <span
                  className="absolute top-12 left-6 h-[calc(100%-24px)] w-px bg-ln-border lg:top-6 lg:left-[calc(50%+28px)] lg:h-px lg:w-[calc(100%-40px)]"
                  aria-hidden
                />
              )}
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-ln-border bg-ln-bg text-base font-semibold text-ln-brand">
                {i + 1}
              </span>
              <span className="text-base leading-6 font-medium text-ln-ink">{s}</span>
            </Reveal>
          ))}
        </ol>
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
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <SectionHeading
          id="analytics-h"
          align="left"
          title="Дерекке сүйеніп шешім қабылдаңыз"
          text="Қай курс жақсы нәтиже беріп жатыр, кімге қосымша қолдау қажет және оқу процесі қалай жүріп жатқанын бірден көріңіз."
        />
        <Reveal variant="scale">
          <div className="rounded-2xl border border-ln-border bg-ln-bg p-5 md:p-6" style={{ boxShadow: '0 12px 40px rgba(9, 30, 66, 0.08)' }}>
            <dl className="m-0 grid grid-cols-2 gap-3">
              {METRICS.map((m) => (
                <div key={m.label} className="rounded-xl border border-ln-border-soft p-4">
                  <dt className="text-sm text-ln-muted">{m.label}</dt>
                  <dd className="tabular m-0 mt-1 text-2xl font-bold text-ln-ink md:text-[28px]">{m.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-xl border border-ln-border-soft p-4" role="img" aria-label="Соңғы 8 аптадағы курсты аяқтау деңгейі 52%-дан 86%-ға дейін өсті">
              <p className="m-0 mb-3 text-sm font-medium text-ln-ink">Аяқтау деңгейі, апта бойынша</p>
              <div className="flex h-28 items-end gap-2" aria-hidden>
                {bars.map((b, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-ln-brand" style={{ height: `${b}%`, opacity: 0.4 + (i / bars.length) * 0.6 }} />
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
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading id="teacher-h" align="left" eyebrow="Оқытушыға" title="Оқытушыға — қарапайым жұмыс ортасы" />
          <ul className="m-0 mt-8 grid list-none gap-3 p-0 sm:grid-cols-2">
            {TEACHER.map(({ icon: Icon, label }, i) => (
              <Reveal as="li" key={label} delay={i * 40} className="flex items-center gap-3 text-base text-ln-ink">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ln-border bg-ln-bg text-ln-brand">
                  <Icon size={18} aria-hidden />
                </span>
                {label}
              </Reveal>
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
      <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
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
        <ul className="m-0 mt-12 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
          {INTEGRATIONS.map(({ name, text, icon: Icon }, i) => (
            <Reveal as="li" key={name} delay={(i % 3) * 60}>
              <div className="ln-card flex h-full items-center gap-4 rounded-xl border border-ln-border bg-ln-bg p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ln-subtle text-ln-ink-2">
                  <Icon size={22} aria-hidden />
                </span>
                <div>
                  <p className="m-0 text-base font-semibold text-ln-ink">{name}</p>
                  <p className="m-0 text-sm text-ln-muted">{text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
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
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ln-brand-soft text-ln-brand">
              <ShieldCheck size={24} aria-hidden />
            </span>
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
        <ul className="m-0 grid list-none gap-3 p-0">
          {SECURITY.map(({ icon: Icon, label }, i) => (
            <Reveal as="li" key={label} delay={i * 50}>
              <div className="flex items-center gap-4 rounded-xl border border-ln-border bg-ln-bg p-4">
                <Icon size={20} className="shrink-0 text-ln-brand" aria-hidden />
                <span className="flex-1 text-base text-ln-ink">{label}</span>
                <Check size={18} className="shrink-0 text-ln-success" aria-label="бар" />
              </div>
            </Reveal>
          ))}
        </ul>
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
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-4 lg:gap-6">
          {AUDIENCES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 60}>
              <article className="ln-card flex h-full flex-col rounded-xl border border-ln-border bg-ln-bg p-6">
                <Icon size={24} className="text-ln-brand" aria-hidden />
                <h3 className="m-0 mt-5 text-lg leading-7 font-semibold text-ln-ink">{title}</h3>
                <p className="m-0 mt-2 text-base leading-6 text-ln-ink-2">{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ---------------- Pricing ---------------- */

const PLANS = [
  {
    name: 'Start',
    price: '39 000 ₸',
    period: '/ ай',
    text: 'Шағын оқу орталықтарына',
    features: ['100 білім алушыға дейін', '10 курс', 'Тапсырмалар мен бағалау', 'Негізгі аналитика', 'Email арқылы қолдау'],
    cta: 'Бастау',
  },
  {
    name: 'Business',
    price: '99 000 ₸',
    period: '/ ай',
    text: 'Өсіп келе жатқан ұйымдарға',
    features: [
      '1 000 білім алушыға дейін',
      'Шектеусіз курстар',
      'Сертификаттар',
      'Кеңейтілген аналитика',
      'Zoom және Teams интеграциясы',
      'Басым қолдау',
    ],
    cta: 'Тегін бастау',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Жеке ұсыныс',
    period: '',
    text: 'Ірі ұйымдар мен ЖОО-ларға',
    features: ['Шектеусіз білім алушылар', 'SSO және API', 'Жеке серверге орналастыру', 'SLA және жеке менеджер', 'Деректерді көшіру'],
    cta: 'Байланысу',
  },
];

function Pricing() {
  return (
    <Section id="pricing" labelledBy="pricing-h" className="bg-ln-soft">
      <Container>
        <SectionHeading id="pricing-h" title="Сізге сай жоспарды таңдаңыз" />
        <div className="mt-12 grid gap-4 md:mt-16 lg:grid-cols-3 lg:gap-6">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 60}>
              <article
                className={`flex h-full flex-col rounded-xl border bg-ln-bg p-6 md:p-8 ${
                  p.popular ? 'border-ln-brand ring-1 ring-ln-brand' : 'border-ln-border'
                }`}
                aria-label={`${p.name} тарифі`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 text-xl font-semibold text-ln-ink">{p.name}</h3>
                  {p.popular && (
                    <span className="rounded-full bg-ln-brand-soft px-2.5 py-0.5 text-xs font-semibold text-ln-brand">Танымал</span>
                  )}
                </div>
                <p className="m-0 mt-1 text-sm text-ln-muted">{p.text}</p>
                <p className="m-0 mt-6">
                  <span className="tabular text-[32px] leading-10 font-bold tracking-[-0.02em] text-ln-ink">{p.price}</span>
                  {p.period && <span className="text-base text-ln-muted"> {p.period}</span>}
                </p>
                <ul className="m-0 mt-6 flex flex-1 list-none flex-col gap-3 p-0">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-base leading-6 text-ln-ink-2">
                      <Check size={18} className="mt-0.5 shrink-0 text-ln-brand" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.popular ? (
                  <PrimaryButton to="/login" size="lg" className="mt-8 w-full">
                    {p.cta}
                  </PrimaryButton>
                ) : (
                  <SecondaryButton to="/login" size="lg" className="mt-8 w-full">
                    {p.cta}
                  </SecondaryButton>
                )}
              </article>
            </Reveal>
          ))}
        </div>
        <p className="m-0 mt-6 text-center text-sm text-ln-muted">Бағалар үлгі ретінде көрсетілген және нақтылауды қажет етеді.</p>
      </Container>
    </Section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCta() {
  return (
    <section aria-labelledby="cta-h" className="py-16 md:py-[88px] lg:py-[120px]" style={{ background: '#172B4D' }}>
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 id="cta-h" className="m-0 text-[28px] leading-9 font-bold tracking-[-0.025em] text-white md:text-4xl md:leading-[44px]">
            Саналы білімге бүгін қадам жасаңыз
          </h2>
          <p className="m-0 mt-4 text-lg leading-7 text-white/80">Sanastra-мен оқу процесін бір жүйеге біріктіріңіз.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryButton to="/login" size="lg">
              Sanastra-ны бастау
            </PrimaryButton>
            <a
              href="mailto:hello@sanastra.kz"
              className="ln-focus inline-flex h-11 items-center justify-center rounded-lg border border-white/30 px-5 text-sm font-semibold text-white! no-underline hover:bg-white/10 hover:text-white!"
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
    <footer className="border-t border-ln-border-soft bg-ln-bg pt-12 pb-8 md:pt-16">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <SanastraLogo />
            <p className="m-0 mt-4 max-w-xs text-base text-ln-ink-2">Білім беруді басқарудың қарапайым әрі заманауи жолы.</p>
          </div>
          {/* Desktop: колонки */}
          {FOOTER.map((col) => (
            <nav key={col.title} aria-label={col.title} className="hidden md:block">
              <p className="m-0 mb-4 text-sm font-semibold text-ln-ink">{col.title}</p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="ln-focus rounded text-sm text-ln-ink-2! no-underline hover:text-ln-brand!">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          {/* Mobile: аккордеон (ТЗ, раздел 27) */}
          <div className="divide-y divide-ln-border-soft border-y border-ln-border-soft md:hidden">
            {FOOTER.map((col) => (
              <details key={col.title} className="group">
                <summary className="ln-focus flex cursor-pointer list-none items-center justify-between py-4 text-base font-semibold text-ln-ink">
                  {col.title}
                  <ChevronDown size={18} className="transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="m-0 flex list-none flex-col gap-3 p-0 pb-4">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="ln-focus rounded text-base text-ln-ink-2! no-underline">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
        <p className="m-0 mt-12 border-t border-ln-border-soft pt-6 text-sm text-ln-muted">
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
    <div id="top" className="min-h-screen bg-ln-bg text-ln-ink" style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
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
