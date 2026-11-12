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
  PlayCircle,
  Video,
} from 'lucide-react';
import type { ReactNode } from 'react';

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

/** Большой макет LMS-дашборда для hero (ТЗ, раздел 7). Декоративный: скрыт от скринридеров, описан через aria-label. */
export function DashboardMockup() {
  return (
    <MockFrame>
      <div role="img" aria-label="Sanastra платформасының басты беті: курстар, тапсырмалар, оқу прогресі және нәтижелер">
        <div className="flex items-center gap-2 border-b border-ln-border-soft bg-ln-soft px-4 py-3" aria-hidden>
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="h-3 w-3 rounded-full bg-ln-border" />
          <span className="ml-3 hidden rounded-md bg-ln-bg px-3 py-1 text-xs text-ln-muted sm:inline">app.sanastra.kz</span>
        </div>
        <div className="flex text-left" aria-hidden>
          <aside className="hidden w-52 shrink-0 border-r border-ln-border-soft bg-ln-soft p-3 md:block">
            <div className="mb-4 flex items-center gap-2 px-2 pt-1">
              <img src="/brand/sanastra-icon-32.png" width={22} height={22} alt="" className="rounded-md" />
              <span className="text-sm font-bold text-ln-ink">Sanastra</span>
            </div>
            {NAV.map(({ icon: Icon, label, active }) => (
              <div
                key={label}
                className={`mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] ${
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
                <p className="m-0 mt-0.5 text-[13px] text-ln-muted">Бүгін 2 сабақ және 1 тапсырма бар</p>
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
                    <div className="mb-1 flex justify-between text-[13px] text-ln-ink-2">
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
                  <div key={String(t)} className="mb-2 flex items-center justify-between gap-2 text-[13px] last:mb-0">
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
                        <span className="text-[10px] text-ln-muted">{d}</span>
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
                  <div key={String(t)} className="mb-2 flex items-center justify-between text-[13px] last:mb-0">
                    <span className="text-ln-ink-2">{t}</span>
                    <span className="tabular font-semibold text-ln-ink">{s}/100</span>
                  </div>
                ))}
              </MockCard>
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-ln-border-soft bg-ln-soft p-3 text-[13px]">
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

function Phone({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <div
      className="ln-shadow w-full max-w-[260px] rounded-[40px] bg-ln-bezel p-2.5"
      role="img"
      aria-label={label}
    >
      <div className="overflow-hidden rounded-[31px] bg-ln-bg" aria-hidden>
        <div className="flex justify-center pt-2">
          <span className="h-1.5 w-16 rounded-full bg-ln-subtle" />
        </div>
        <div className="flex h-[440px] flex-col p-4">
          <p className="m-0 mb-3 text-base font-bold text-ln-ink">{title}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Три экрана мобильного приложения (ТЗ, раздел 14). */
export function PhoneScreens() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:items-end">
      <Phone title="Бүгін" label="Мобильді қосымша: бүгінгі жоспар">
        <div className="mb-3 rounded-2xl bg-ln-brand p-4 text-white">
          <p className="m-0 text-xs opacity-80">Келесі сабақ · 14:00</p>
          <p className="m-0 mt-1 font-semibold">Алгебра</p>
          <p className="m-0 mt-3 inline-flex rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-ln-brand">Қосылу</p>
        </div>
        {['Квадрат теңдеулер', 'Essay: My city'].map((t, i) => (
          <div key={t} className="mb-2 rounded-xl border border-ln-border-soft p-3">
            <p className="m-0 text-sm font-medium text-ln-ink">{t}</p>
            <p className="m-0 text-xs text-ln-muted">{i ? '3 күн қалды' : 'Ертең, 18:00'}</p>
          </div>
        ))}
      </Phone>
      <Phone title="Курс" label="Мобильді қосымша: курс беті">
        <div className="mb-3 flex h-24 items-center justify-center rounded-2xl bg-ln-brand-soft text-ln-accent">
          <BookOpen size={32} />
        </div>
        <p className="m-0 font-semibold text-ln-ink">Python негіздері</p>
        <p className="m-0 mb-2 text-xs text-ln-muted">12 сабақ · 31% аяқталды</p>
        <Bar value={31} />
        <div className="mt-3 flex flex-col gap-2">
          {['1. Айнымалылар', '2. Шарттар', '3. Циклдар', '4. Функциялар'].map((l, i) => (
            <div key={l} className="flex items-center gap-2 text-sm text-ln-ink-2">
              {i < 2 ? <CheckCircle2 size={16} className="text-ln-success" /> : <PlayCircle size={16} className="text-ln-muted" />}
              {l}
            </div>
          ))}
        </div>
      </Phone>
      <Phone title="Тапсырма" label="Мобильді қосымша: тапсырма беті">
        <span className="mb-2 inline-flex self-start rounded-md bg-ln-warning-soft px-2 py-0.5 text-xs font-medium text-ln-warning">
          2 сағат қалды
        </span>
        <p className="m-0 font-semibold text-ln-ink">Квадрат теңдеулер</p>
        <p className="m-0 mt-1 text-sm text-ln-ink-2">5 есепті шығарып, шешімнің суретін жүктеңіз.</p>
        <div className="mt-4 flex h-24 items-center justify-center rounded-xl border border-dashed border-ln-border text-xs text-ln-muted">
          Файлды жүктеу
        </div>
        <p className="m-0 mt-auto rounded-lg bg-ln-brand py-2.5 text-center text-sm font-semibold text-white">Жіберу</p>
      </Phone>
    </div>
  );
}
