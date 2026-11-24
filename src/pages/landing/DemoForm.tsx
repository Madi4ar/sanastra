import { CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { track } from './analytics';
import { BRAND, SALES_EMAIL } from './content';

/** Связь формы со страницей: страница помнит, с какого CTA пришёл посетитель, и отправляет событие открытия один раз. */
export type DemoChannel = { open: (placement?: string) => void; source: () => string };

type Values = { name: string; organization: string; contact: string; comment: string; consent: boolean };
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = { name: '', organization: '', contact: '', comment: '', consent: false };

function validate(v: Values): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = 'Атыңызды жазыңыз';
  if (!v.organization.trim()) e.organization = 'Ұйым атауын жазыңыз';
  const contact = v.contact.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const isPhone = contact.replace(/\D/g, '').length >= 10;
  if (!contact) e.contact = 'Телефон немесе email жазыңыз';
  else if (!isEmail && !isPhone) e.contact = 'Телефон нөмірін немесе email-ді дұрыс жазыңыз';
  if (!v.consent) e.consent = 'Деректерді өңдеуге келісім қажет';
  return e;
}

/** Письмо в отдел продаж: пока нет API заявок, демо запрашивается через согласованный канал — email. */
function mailtoFor(v: Values) {
  const body = [
    `Аты: ${v.name.trim()}`,
    `Ұйым: ${v.organization.trim()}`,
    `Байланыс: ${v.contact.trim()}`,
    v.comment.trim() && `Түсініктеме: ${v.comment.trim()}`,
  ]
    .filter(Boolean)
    .join('\n');
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`${BRAND} демо сұрау`)}&body=${encodeURIComponent(body)}`;
}

const input =
  'ln-focus mt-1.5 block w-full rounded-xl border border-ln-border bg-ln-bg px-4 text-[1.0625rem] text-ln-ink placeholder:text-ln-muted aria-[invalid=true]:border-ln-danger';

export function DemoForm({ demo }: { demo: DemoChannel }) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  const set = <K extends keyof Values>(k: K, v: Values[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  // Открытие формы без перехода по CTA (сам дошёл до неё и начал заполнять)
  const onFocus = () => demo.open();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    const first = (Object.keys(next) as (keyof Values)[])[0];
    if (first) {
      document.getElementById(`demo-${first}`)?.focus();
      return;
    }
    // В аналитику — только источник, без данных формы
    track({ event: 'landing_demo_submit', source: demo.source() });
    window.location.href = mailtoFor(values);
    setSent(true);
  };

  if (sent) {
    return (
      <div id="demo" className="scroll-mt-24 rounded-[28px] bg-ln-bg p-7 md:p-9" role="status">
        <CheckCircle2 size={40} strokeWidth={1.75} className="text-ln-success" aria-hidden />
        <h3 ref={successRef} tabIndex={-1} className="m-0 mt-5 text-[1.5rem] leading-8 font-semibold text-ln-ink outline-none">
          Рақмет! Өтінім дайын
        </h3>
        <p className="m-0 mt-3 text-[1.0625rem] leading-[1.75rem] text-ln-ink-2">
          Пошта бағдарламасында хат ашылды — оны жіберіңіз, біз сізбен хабарласамыз. Хат ашылмаса, бізге тікелей жазыңыз:{' '}
          <a href={mailtoFor(values)} className="ln-focus rounded font-medium text-ln-accent!">
            {SALES_EMAIL}
          </a>
        </p>
      </div>
    );
  }

  const field = (k: 'name' | 'organization' | 'contact', label: string, autoComplete: string, extra: { inputMode?: 'text' | 'email' } = {}) => (
    <div>
      <label htmlFor={`demo-${k}`} className="text-[0.9375rem] font-medium text-ln-ink">
        {label}
      </label>
      <input
        id={`demo-${k}`}
        name={k}
        type="text"
        autoComplete={autoComplete}
        value={values[k]}
        onChange={(e) => set(k, e.target.value)}
        aria-invalid={!!errors[k]}
        aria-describedby={errors[k] ? `demo-${k}-err` : undefined}
        aria-required
        className={`${input} h-12`}
        {...extra}
      />
      {errors[k] && (
        <p id={`demo-${k}-err`} className="m-0 mt-1.5 text-[0.875rem] text-ln-danger">
          {errors[k]}
        </p>
      )}
    </div>
  );

  return (
    <form
      id="demo"
      noValidate
      onSubmit={onSubmit}
      onFocus={onFocus}
      aria-labelledby="demo-h"
      className="scroll-mt-24 rounded-[28px] bg-ln-bg p-6 md:p-8"
    >
      <h3 id="demo-h" className="m-0 text-[1.375rem] leading-7 font-semibold text-ln-ink">
        Жеке демо сұрау
      </h3>
      <p className="m-0 mt-1.5 text-[0.9375rem] leading-6 text-ln-muted">Платформаны сіздің міндеттеріңізге сай көрсетеміз.</p>
      <div className="mt-6 grid gap-4">
        {field('name', 'Атыңыз', 'name')}
        {field('organization', 'Ұйым', 'organization')}
        {field('contact', 'Телефон немесе email', 'email', { inputMode: 'text' })}
        <div>
          <label htmlFor="demo-comment" className="text-[0.9375rem] font-medium text-ln-ink">
            Түсініктеме <span className="font-normal text-ln-muted">(міндетті емес)</span>
          </label>
          <textarea
            id="demo-comment"
            name="comment"
            rows={3}
            value={values.comment}
            onChange={(e) => set('comment', e.target.value)}
            className={`${input} resize-y py-3`}
          />
        </div>
        <div>
          <label className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-6 text-ln-ink-2">
            <input
              id="demo-consent"
              type="checkbox"
              checked={values.consent}
              onChange={(e) => set('consent', e.target.checked)}
              aria-invalid={!!errors.consent}
              aria-describedby={errors.consent ? 'demo-consent-err' : undefined}
              className="ln-focus mt-0.5 h-5 w-5 shrink-0 accent-[var(--ln-brand)]"
            />
            <span>Дербес деректерді өңдеу саясатымен келісемін</span>
          </label>
          {errors.consent && (
            <p id="demo-consent-err" className="m-0 mt-1.5 text-[0.875rem] text-ln-danger">
              {errors.consent}
            </p>
          )}
        </div>
      </div>
      <button
        type="submit"
        className="ln-focus ln-press mt-6 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full border-0 bg-ln-brand px-6 text-[1.0625rem] font-medium text-white hover:bg-ln-brand-hover"
      >
        Өтінім жіберу
      </button>
    </form>
  );
}
