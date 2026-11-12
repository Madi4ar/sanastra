import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router';

/** Логотип Sanastra: знак из брендбука + словесная часть. */
export function SanastraLogo({ inverted = false, to = '/' }: { inverted?: boolean; to?: string }) {
  return (
    <Link to={to} className="ln-focus flex items-center gap-2.5 rounded-md no-underline" aria-label="Sanastra — басты бет">
      <img src="/brand/sanastra-icon-64.png" width={32} height={32} alt="" className="rounded-lg" />
      <span className={`text-xl font-semibold tracking-[-0.02em] ${inverted ? 'text-white' : 'text-ln-ink'}`}>Sanastra</span>
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

type BtnProps = { children: ReactNode; to?: string; href?: string; size?: 'md' | 'lg'; className?: string };

// Кнопки-«пилюли»: высота не меньше 44 px; отклик на нажатие — сразу, на pointer-down (.ln-press)
const base =
  'ln-focus ln-press inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap no-underline';
const sizes = { md: 'h-11 px-5 text-[0.9375rem] leading-5', lg: 'h-12 px-6 text-[1.0625rem] leading-6' };

function BtnLink({ to, href, className, children }: { to?: string; href?: string; className: string; children: ReactNode }) {
  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function PrimaryButton({ children, to, href, size = 'md', className = '' }: BtnProps) {
  return (
    <BtnLink to={to} href={href} className={`${base} ${sizes[size]} bg-ln-brand! text-white! hover:bg-ln-brand-hover! hover:text-white! ${className}`}>
      {children}
    </BtnLink>
  );
}

export function SecondaryButton({ children, to, href, size = 'md', className = '' }: BtnProps) {
  return (
    <BtnLink
      to={to}
      href={href}
      className={`${base} ${sizes[size]} bg-ln-subtle! text-ln-ink! hover:bg-ln-border-soft! hover:text-ln-ink! ${className}`}
    >
      {children}
    </BtnLink>
  );
}

/** Текстовая кнопка без фона — для второстепенных действий рядом с основной (например, «Кіру» в шапке). */
export function GhostButton({ children, to, href, size = 'md', className = '' }: BtnProps) {
  return (
    <BtnLink to={to} href={href} className={`${base} ${sizes[size]} text-ln-ink! hover:bg-ln-subtle! hover:text-ln-ink! ${className}`}>
      {children}
    </BtnLink>
  );
}
