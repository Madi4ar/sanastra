import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router';

/** Логотип Sanastra: знак из брендбука + словесная часть. */
export function SanastraLogo({ inverted = false, to = '/' }: { inverted?: boolean; to?: string }) {
  return (
    <Link to={to} className="ln-focus flex items-center gap-2.5 rounded-md no-underline" aria-label="Sanastra — басты бет">
      <img src="/brand/sanastra-icon-64.png" width={32} height={32} alt="" className="rounded-lg" />
      <span className={`text-xl font-bold tracking-[-0.02em] ${inverted ? 'text-white' : 'text-ln-ink'}`}>Sanastra</span>
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

/** Контейнер страницы: max-width 1240, отступы 20 / 24 / 32 px. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-5 md:px-6 lg:px-8 ${className}`}>{children}</div>;
}

/** Секция с вертикальными интервалами 64 / 88 / 120 px. */
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
    <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-20 py-16 md:py-[88px] lg:py-[120px] ${className}`}>
      {children}
    </section>
  );
}

/** Заголовок секции: H2 36/44 bold, -0.025em; подзаголовок Body Large. */
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
      {eyebrow && <p className="m-0 mb-3 text-sm font-semibold text-ln-brand">{eyebrow}</p>}
      <h2 id={id} className="m-0 text-[28px] leading-9 font-bold tracking-[-0.025em] text-ln-ink md:text-4xl md:leading-[44px]">
        {title}
      </h2>
      {text && <p className="m-0 mt-4 text-lg leading-7 text-ln-ink-2">{text}</p>}
    </Reveal>
  );
}

type BtnProps = { children: ReactNode; to?: string; href?: string; size?: 'md' | 'lg'; className?: string };

const base =
  'ln-focus inline-flex items-center justify-center gap-2 rounded-lg text-sm leading-5 font-semibold no-underline transition-colors';
const sizes = { md: 'h-10 px-4', lg: 'h-11 px-5' };

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
      className={`${base} ${sizes[size]} border border-ln-border bg-ln-bg! text-ln-ink! hover:bg-ln-soft! hover:text-ln-ink! ${className}`}
    >
      {children}
    </BtnLink>
  );
}
