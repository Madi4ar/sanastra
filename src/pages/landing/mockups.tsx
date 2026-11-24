import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  MessageSquare,
  PlayCircle,
  Table2,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';
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

const NAV = [
  { icon: LayoutDashboard, label: 'Басты бет', active: true },
  { icon: BookOpen, label: 'Курстар' },
  { icon: ClipboardList, label: 'Тапсырмалар' },
  { icon: BarChart3, label: 'Аналитика' },
  { icon: CalendarDays, label: 'Күнтізбе' },
];

const WEEK = [
  ['Дс', 40],
  ['Сс', 65],
  ['Ср', 50],
  ['Бс', 80],
  ['Жм', 70],
  ['Сб', 30],
  ['Жс', 20],
] as const;

/** Большой макет LMS-дашборда для hero. Декоративный: скрыт от скринридеров, описан через aria-label. Данные — демонстрационные. */
export function DashboardMockup() {
  return (
    <MockFrame>
      <div role="img" aria-label="Zuie платформасындағы білім алушының басты беті: курстар, тапсырмалар, оқу прогресі және нәтижелер (демонстрациялық деректер)">
        <div className="flex items-center gap-2 border-b border-ln-border-soft bg-ln-soft px-4 py-3" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="ml-3 hidden rounded-md bg-ln-bg px-3 py-1 text-xs text-ln-muted sm:inline">Zuie · Білім алушы кабинеті</span>
        </div>
        <div className="flex text-left" aria-hidden>
          <aside className="hidden w-52 shrink-0 border-r border-ln-border-soft bg-ln-soft p-3 md:block">
            <div className="mb-4 flex items-center gap-2 px-2 pt-1">
              <BrandMark size={22} />
              <span className="text-sm font-bold text-ln-ink">Zuie</span>
            </div>
            {NAV.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8125rem] tracking-[0.01em] ${
                  active ? 'bg-ln-brand-soft font-semibold text-ln-accent' : 'text-ln-ink-2'
                }`}
              >
                <Icon size={16} />
                {label}
              </div>
            ))}
          </aside>
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="m-0 text-lg font-bold text-ln-ink sm:text-xl">Қайырлы күн, Айдана!</p>
                <p className="m-0 mt-0.5 text-[0.8125rem] tracking-[0.01em] text-ln-muted">Бүгін 2 сабақ және 1 тапсырма бар</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ln-border-soft text-ln-ink-2">
                <Bell size={16} />
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MockCard title="Менің курстарым" icon={<BookOpen size={16} />}>
                {[
                  ['Алгебра', 72],
                  ['Ағылшын тілі B1', 54],
                  ['Python негіздері', 31],
                ].map(([name, v]) => (
                  <div key={name} className="mb-2.5 last:mb-0">
                    <div className="mb-1 flex justify-between text-[0.8125rem] tracking-[0.01em] text-ln-ink-2">
                      <span>{name}</span>
                      <span className="tabular font-medium text-ln-ink">{v}%</span>
                    </div>
                    <Bar value={Number(v)} />
                  </div>
                ))}
              </MockCard>
              <MockCard title="Алдағы тапсырмалар" icon={<ClipboardList size={16} />}>
                {[
                  ['Квадрат теңдеулер', 'Ертең, 18:00', true],
                  ['Essay: My city', '3 күн қалды', false],
                  ['Мини-жоба: калькулятор', '7 күн қалды', false],
                ].map(([t, d, urgent]) => (
                  <div key={String(t)} className="mb-2 flex items-center justify-between gap-2 text-[0.8125rem] tracking-[0.01em] last:mb-0">
                    <span className="truncate text-ln-ink-2">{t}</span>
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                        urgent ? 'bg-ln-warning-soft text-ln-warning' : 'bg-ln-subtle text-ln-ink-2'
                      }`}
                    >
                      {d}
                    </span>
                  </div>
                ))}
              </MockCard>
              <MockCard title="Оқу прогресі" icon={<BarChart3 size={16} />}>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="tabular m-0 text-3xl font-bold text-ln-ink">68%</p>
                    <p className="m-0 text-xs text-ln-success">Осы аптада +12%</p>
                  </div>
                  <div className="flex h-14 items-end gap-1.5">
                    {WEEK.map(([d, v]) => (
                      <div key={d} className="flex flex-col items-center gap-1">
                        <div className="w-3 rounded-sm bg-ln-brand" style={{ height: `${v * 0.45}px`, opacity: 0.35 + v / 160 }} />
                        <span className="text-[0.625rem] text-ln-muted">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </MockCard>
              <MockCard title="Соңғы нәтижелер" icon={<CheckCircle2 size={16} />}>
                {[
                  ['Алгебра: тест', 92],
                  ['Listening', 85],
                  ['Python quiz', 78],
                ].map(([t, s]) => (
                  <div key={String(t)} className="mb-2 flex items-center justify-between text-[0.8125rem] tracking-[0.01em] last:mb-0">
                    <span className="text-ln-ink-2">{t}</span>
                    <span className="tabular font-semibold text-ln-ink">{s}/100</span>
                  </div>
                ))}
              </MockCard>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-ln-border-soft bg-ln-soft p-3 text-[0.8125rem] tracking-[0.01em]">
              <CalendarDays size={16} className="shrink-0 text-ln-accent" />
              <span className="text-ln-ink-2">
                <b className="font-semibold text-ln-ink">Бүгін, 14:00</b> · Алгебра · онлайн-сабақ
              </span>
              <span className="ml-auto hidden items-center gap-1 rounded-md bg-ln-brand-soft px-2 py-1 text-xs font-medium text-ln-accent sm:inline-flex">
                <Video size={12} /> Қосылу
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
  const rows = [
    ['Айдана С.', 'Тексерілді', 92],
    ['Нұрлан Ә.', 'Тексерілді', 85],
    ['Мадина Қ.', 'Күтуде', null],
    ['Ерлан Т.', 'Күтуде', null],
  ] as const;
  return (
    <MockFrame>
      <div className="p-5 sm:p-6" role="img" aria-label="Оқытушы интерфейсі: тапсырмаларды тексеру тізімі">
        <div aria-hidden>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-medium text-ln-muted">Алгебра · 9 сынып</p>
              <p className="m-0 font-semibold text-ln-ink">Тапсырма: Квадрат теңдеулер</p>
            </div>
            <span className="rounded-md bg-ln-brand-soft px-2 py-1 text-xs font-semibold text-ln-accent">24 / 28 тапсырды</span>
          </div>
          <div className="divide-y divide-ln-border-soft rounded-xl border border-ln-border-soft">
            {rows.map(([name, status, score]) => (
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
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** «Бүгін» — экран обучающегося. */
export function LearnerMockup() {
  return (
    <MockFrame>
      <div className="p-5 sm:p-6" role="img" aria-label="Білім алушының бүгінгі жоспары: сабақ, тапсырма және нәтиже">
        <div aria-hidden>
          <p className="m-0 mb-4 font-semibold text-ln-ink">Бүгін</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-ln-border-soft p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ln-brand-soft text-ln-accent">
                <PlayCircle size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-ln-ink">Сабақ: Функция графигі</p>
                <p className="m-0 text-xs text-ln-muted">Алгебра · 14:00–14:45</p>
              </div>
              <span className="text-xs font-semibold text-ln-accent">Бастау</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-ln-border-soft p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ln-warning-soft text-ln-warning">
                <FileText size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-ln-ink">Тапсырма: Квадрат теңдеулер</p>
                <p className="m-0 flex items-center gap-1 text-xs text-ln-warning">
                  <Clock size={12} /> 2 сағат қалды
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-ln-border-soft p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ln-success-soft text-ln-success">
                <CheckCircle2 size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-ln-ink">Нәтиже: Listening</p>
                <p className="m-0 text-xs text-ln-muted">Ағылшын тілі B1</p>
              </div>
              <span className="tabular text-sm font-semibold text-ln-success">85/100</span>
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** Подпись под продуктовыми макетами: цифры на них не являются показателями компании. */
export function DemoNote({ className = '' }: { className?: string }) {
  return (
    <p className={`m-0 inline-flex items-center gap-1.5 rounded-full bg-ln-subtle px-3 py-1 text-[0.8125rem] tracking-[0.01em] text-ln-ink-2 ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-ln-muted" aria-hidden />
      Демонстрациялық деректер
    </p>
  );
}

/** Кабинет администратора организации: подписка, тариф, лимиты и разделы (по реальному экрану продукта). */
export function AdminMockup() {
  const sections = ['Курстар', 'Топтар', 'Тренерлер', 'Бөлімдер', 'Рөлдер', 'Есептер'];
  const usage = [
    ['Білім алушылар', 64, '64 / 100'],
    ['Курстар', 36, '18 / 50'],
    ['Қойма', 22, '22 / 100 ГБ'],
  ] as const;
  return (
    <MockFrame>
      <div className="p-5 sm:p-6" role="img" aria-label="Әкімші кабинеті: жазылым, тариф, лимиттерді пайдалану және ұйым бөлімдері">
        <div aria-hidden>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="m-0 text-xs font-medium text-ln-muted">«Білім» оқу орталығы</p>
              <p className="m-0 font-semibold text-ln-ink">Ұйым кабинеті</p>
            </div>
            <span className="rounded-md bg-ln-success-soft px-2 py-1 text-xs font-semibold text-ln-success">Стандарт · белсенді</span>
          </div>
          <div className="mb-3 rounded-xl border border-ln-border-soft p-4">
            <p className="m-0 mb-3 text-sm font-semibold text-ln-ink">Лимиттерді пайдалану</p>
            {usage.map(([label, v, text]) => (
              <div key={label} className="mb-2.5 last:mb-0">
                <div className="mb-1 flex justify-between text-[0.8125rem] tracking-[0.01em] text-ln-ink-2">
                  <span>{label}</span>
                  <span className="tabular font-medium text-ln-ink">{text}</span>
                </div>
                <Bar value={v} />
              </div>
            ))}
          </div>
          <p className="m-0 mb-2 text-sm font-semibold text-ln-ink">Жылдам әрекеттер</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {sections.map((t) => (
              <span key={t} className="rounded-lg bg-ln-soft px-3 py-2 text-[0.8125rem] tracking-[0.01em] text-ln-ink-2">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** Конструктор курса: структура «модуль → күн → элемент», обязательные элементы и разные типы контента. */
export function CourseBuilderMockup() {
  const items = [
    { icon: Video, label: 'Бейнесабақ', required: true },
    { icon: FileText, label: 'Конспект (PDF)', required: false },
    { icon: ClipboardList, label: 'Тест: 10 сұрақ', required: true },
  ];
  return (
    <div className="rounded-2xl bg-ln-bg p-4" aria-hidden>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.8125rem] tracking-[0.01em]">
        <span className="rounded-md bg-ln-subtle px-2 py-0.5 font-medium text-ln-ink-2">1-модуль</span>
        <span className="font-semibold text-ln-ink">Кіріспе</span>
        <span className="ml-auto text-ln-muted">1-күн / 3</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map(({ icon: Icon, label, required }) => (
          <div key={label} className="flex items-center gap-2.5 rounded-xl border border-ln-border-soft px-3 py-2.5 text-[0.8125rem] tracking-[0.01em]">
            <Icon size={16} className="shrink-0 text-ln-accent" />
            <span className="min-w-0 flex-1 truncate text-ln-ink">{label}</span>
            {required && <span className="rounded-md bg-ln-brand-soft px-2 py-0.5 text-xs font-medium text-ln-accent">Міндетті</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const SCATTERED = [
  { icon: FileText, title: 'Материалдар', where: 'Бөлек папкаларда' },
  { icon: MessageSquare, title: 'Тапсырмалар', where: 'Мессенджерде' },
  { icon: CalendarDays, title: 'Кесте', where: 'Басқа сервисте' },
  { icon: Table2, title: 'Есептер', where: 'Excel-де' },
];

const UNIFIED = ['Курстар мен материалдар', 'Топтар мен кесте', 'Тапсырмалар мен бағалар', 'Прогресс пен есептер'];

/** «До / после»: разрозненные инструменты против единого экрана. На мобильном — друг под другом, без анимации. */
export function BeforeAfter() {
  return (
    <div className="grid gap-4 md:grid-cols-2 md:gap-5">
      <figure className="m-0 rounded-[28px] border border-dashed border-ln-border bg-ln-bg p-6 md:p-8">
        <figcaption className="mb-5 text-[0.9375rem] font-semibold text-ln-muted">Бұрын — бірнеше жүйе</figcaption>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
          {SCATTERED.map(({ icon: Icon, title, where }, i) => (
            <li key={title} className={`rounded-2xl bg-ln-soft p-4 ${i % 2 ? 'md:translate-y-3 md:rotate-1' : 'md:-rotate-1'}`}>
              <Icon size={20} strokeWidth={1.75} className="text-ln-muted" aria-hidden />
              <p className="m-0 mt-3 text-[0.9375rem] font-semibold text-ln-ink">{title}</p>
              <p className="m-0 mt-0.5 text-[0.8125rem] tracking-[0.01em] text-ln-muted">{where}</p>
            </li>
          ))}
        </ul>
      </figure>
      <figure className="ln-shadow m-0 rounded-[28px] bg-ln-bg p-6 ring-2 ring-ln-brand md:p-8">
        <figcaption className="mb-5 flex items-center gap-2 text-[0.9375rem] font-semibold text-ln-ink">
          <BrandMark size={22} /> Қазір — бір платформа
        </figcaption>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {UNIFIED.map((t) => (
            <li key={t} className="flex items-center gap-3 rounded-xl bg-ln-soft px-4 py-3 text-[0.9375rem] text-ln-ink">
              <CheckCircle2 size={18} className="shrink-0 text-ln-success" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
      </figure>
    </div>
  );
}
