import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router';

/** Знак Zuie: буква в бренд-плашке — используется в шапке, подвале и продуктовых макетах. */
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

/** Логотип Zuie: знак + словесная часть. */
export function BrandLogo({ inverted = false, to = '/', ariaLabel }: { inverted?: boolean; to?: string; ariaLabel: string }) {
  return (
    <Link to={to} className="ln-focus flex items-center gap-2.5 rounded-md no-underline" aria-label={ariaLabel}>
      <BrandMark />
      <span className={`text-xl font-semibold tracking-[-0.02em] ${inverted ? 'text-white' : 'text-ln-ink'}`}>Zuie</span>
    </Link>
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

/**
 * Число, которое «набегает» до значения при появлении в экране: «86%», «1 248».
 * Без IntersectionObserver или при «меньше движения» — сразу итоговое значение.
 */
export function CountUp({ value, duration = 1200 }: { value: string; duration?: number }) {
  const match = /^(\D*)([\d\s\u00a0]+)(.*)$/.exec(value);
  const target = match ? Number(match[2]!.replace(/\D/g, '')) : NaN;
  const animated =
    !Number.isNaN(target) &&
    typeof IntersectionObserver !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ref = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(animated ? 0 : target);

  useEffect(() => {
    const el = ref.current;
    if (!animated || !el) return;
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / duration);
        setCurrent(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [animated, target, duration]);

  if (!match || Number.isNaN(target)) return <>{value}</>;
  // Разделитель тысяч — как в исходной строке (обычный или неразрывный пробел)
  const sep = /\u00a0/.test(match[2]!) ? '\u00a0' : ' ';
  const formatted = String(current).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return (
    <span ref={ref}>
      {/* Скринридер слышит итоговое значение, а не промежуточные кадры */}
      <span aria-hidden>
        {match[1]}
        {formatted}
        {match[3]}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
