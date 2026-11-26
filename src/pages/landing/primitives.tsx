import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router';
import { track } from './analytics';
import { ENDORSER, ENDORSER_URL } from './content';
import { useLandingText } from './i18n';

/** Знак Zhue: буква в бренд-плашке — используется в шапке, подвале и продуктовых макетах. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-lg bg-ln-brand font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.56, lineHeight: 1 }}
    >
      Z
    </span>
  );
}

/** Логотип Zhue: знак + словесная часть. */
export function BrandLogo({ inverted = false, to = '/', ariaLabel }: { inverted?: boolean; to?: string; ariaLabel: string }) {
  return (
    <Link to={to} className="ln-focus flex items-center gap-2.5 rounded-md no-underline" aria-label={ariaLabel}>
      <BrandMark />
      <span className={`text-xl font-semibold tracking-[-0.02em] ${inverted ? 'text-white' : 'text-ln-ink'}`}>Zhue</span>
    </Link>
  );
}

/**
 * Подпись создателя продукта: «Beyim Ustaz әзірлеген» / «Разработано Beyim Ustaz».
 * Визуально вторична (11–13 px), Beyim Ustaz — внешняя ссылка; клик учитывается событием beyim_ustaz_click.
 * Текст, а не логотип: объединять знаки в новый lockup до согласования с владельцем бренда нельзя.
 */
export function Endorsement({
  placement,
  className = '',
  linkClassName = 'text-ln-ink-2! hover:text-ln-ink!',
}: {
  placement: 'header' | 'hero' | 'footer';
  className?: string;
  linkClassName?: string;
}) {
  const t = useLandingText().footer.endorse;
  return (
    <span className={className}>
      {t.before}
      <a
        href={ENDORSER_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={t.link}
        onClick={() => track({ event: 'beyim_ustaz_click', placement })}
        className={`ln-focus rounded font-semibold no-underline hover:underline ${linkClassName}`}
      >
        {ENDORSER}
      </a>
      {t.after}
    </span>
  );
}

/** Шапка: логотип Zhue — главный, рядом через разделитель — подпись создателя в две строки, чтобы связка помещалась и на 1024, и на 360 px. */
export function BrandLockup({ to, ariaLabel }: { to: string; ariaLabel: string }) {
  return (
    <div className="flex shrink-0 items-center gap-3">
      <BrandLogo to={to} ariaLabel={ariaLabel} />
      <span aria-hidden className="h-7 w-px bg-ln-border" />
      <Endorsement placement="header" className="block max-w-[6.5rem] text-[0.6875rem] leading-[0.875rem] text-ln-muted sm:text-[0.75rem] sm:leading-4" />
    </div>
  );
}

/** Появление при прокрутке: opacity 0→1, translateY 16→0 (или scale 0.98→1). Без IntersectionObserver — сразу видно. */
export function Reveal({
  children,
  className = '',
  variant = 'up',
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'up' | 'scale';
  delay?: number;
  as?: ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);
  return (
    <Tag
      ref={ref}
      className={`${variant === 'scale' ? 'reveal-scale' : 'reveal'} ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/** Контейнер страницы: max-width 1200, отступы 20 / 24 / 32 px. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 md:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** Секция с вертикальными интервалами 80 / 112 / 144 px. */
export function Section({
  id,
  children,
  className = '',
  labelledBy,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-20 py-20 md:py-28 lg:py-36 ${className}`}>
      {children}
    </section>
  );
}

/** Заголовок секции: H2 32/38 → 48/54 semibold, -0.03em; подзаголовок 19/30. Надзаголовок — нейтральный, без цвета бренда. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  text,
  align = 'center',
}: {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <Reveal className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      {eyebrow && <p className="m-0 mb-3 text-[1.0625rem] leading-6 font-semibold text-ln-muted">{eyebrow}</p>}
      <h2
        id={id}
        className="m-0 text-[2rem] leading-[2.375rem] font-semibold tracking-[-0.03em] text-balance text-ln-ink md:text-5xl md:leading-[3.375rem]"
      >
        {title}
      </h2>
      {text && <p className="m-0 mt-5 text-[1.1875rem] leading-[1.875rem] text-pretty text-ln-ink-2">{text}</p>}
    </Reveal>
  );
}

type BtnProps = {
  children: ReactNode;
  to?: string;
  href?: string;
  size?: 'md' | 'lg';
  className?: string;
  /** Место кнопки на странице — для события landing_cta_click (ловится делегированно на корне лендинга). */
  cta?: string;
  onClick?: () => void;
};

// Кнопки-«пилюли»: высота не меньше 44 px; отклик на нажатие — сразу, на pointer-down (.ln-press)
const base =
  'ln-focus ln-press inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap no-underline';
const sizes = { md: 'h-11 px-5 text-[0.9375rem] leading-5', lg: 'h-12 px-6 text-[1.0625rem] leading-6' };

function BtnLink({ to, href, className, children, cta, onClick }: Omit<BtnProps, 'size'> & { className: string }) {
  const extra = { className, onClick, 'data-cta': cta };
  if (to) {
    return (
      <Link to={to} {...extra}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} {...extra}>
      {children}
    </a>
  );
}

export function PrimaryButton({ children, size = 'md', className = '', ...rest }: BtnProps) {
  return (
    <BtnLink {...rest} className={`${base} ${sizes[size]} bg-ln-brand! text-white! hover:bg-ln-brand-hover! hover:text-white! ${className}`}>
      {children}
    </BtnLink>
  );
}

export function SecondaryButton({ children, size = 'md', className = '', ...rest }: BtnProps) {
  return (
    <BtnLink
      {...rest}
      className={`${base} ${sizes[size]} bg-ln-subtle! text-ln-ink! hover:bg-ln-border-soft! hover:text-ln-ink! ${className}`}
    >
      {children}
    </BtnLink>
  );
}

/** Текстовая кнопка без фона — для второстепенных действий рядом с основной (например, «Кіру» в шапке). */
export function GhostButton({ children, size = 'md', className = '', ...rest }: BtnProps) {
  return (
    <BtnLink {...rest} className={`${base} ${sizes[size]} text-ln-ink! hover:bg-ln-subtle! hover:text-ln-ink! ${className}`}>
      {children}
    </BtnLink>
  );
}
