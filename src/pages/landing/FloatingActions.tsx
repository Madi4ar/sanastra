import { ArrowUp, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLandingLang, type LandingLang } from './i18n';

/** Номер WhatsApp отдела продаж в международном формате без «+» и пробелов. Пустой — кнопка чата не показывается. */
export const WHATSAPP_PHONE = '77000000000';

const TEXT: Record<LandingLang, { top: string; chat: string; message: string; slogans: string[] }> = {
  kk: {
    top: 'Жоғарыға оралу',
    chat: 'WhatsApp-та жазу',
    message: 'Сәлеметсіз бе! Zuie платформасы туралы білгім келеді.',
    slogans: [
      'Сұрағыңыз бар ма? WhatsApp-та жауап береміз',
      'Тегін бастаңыз — банк картасы қажет емес',
      'Жеке демо — бір хабарлама қашықтықта',
      'Ұйымыңызға сай тарифті бірге таңдайық',
      'Командаңызды бүгін-ақ қосыңыз',
    ],
  },
  ru: {
    top: 'Наверх',
    chat: 'Написать в WhatsApp',
    message: 'Здравствуйте! Хочу узнать о платформе Zuie.',
    slogans: [
      'Есть вопросы? Ответим в WhatsApp',
      'Начните бесплатно — карта не нужна',
      'Персональное демо — в одном сообщении',
      'Подберём тариф под вашу организацию',
      'Подключите команду уже сегодня',
    ],
  },
};

/**
 * Плавающие кнопки справа внизу: «наверх» (появляется после прокрутки) и круглая кнопка WhatsApp,
 * которая мягко «плавает»; при наведении или фокусе слева выезжает флажок с призывом — каждый раз новый.
 */
export function FloatingActions() {
  const t = TEXT[useLandingLang()];
  const [showTop, setShowTop] = useState(false);
  const [slogan, setSlogan] = useState(0);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Следующий слоган — при уходе курсора, чтобы текст не менялся у пользователя на глазах
  const nextSlogan = () => setSlogan((i) => (i + 1) % t.slogans.length);
  const chatHref = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(t.message)}`;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-30 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
      <a
        href="#top"
        aria-label={t.top}
        aria-hidden={!showTop}
        tabIndex={showTop ? undefined : -1}
        data-visible={showTop}
        className="ln-focus ln-press ln-fab-top ln-shadow flex h-12 w-12 items-center justify-center rounded-full border border-ln-border-soft bg-ln-bg! text-ln-ink! no-underline hover:bg-ln-soft!"
      >
        <ArrowUp size={20} aria-hidden />
      </a>
      {WHATSAPP_PHONE && (
        <div className="group pointer-events-auto relative flex items-center" onMouseLeave={nextSlogan} onBlur={nextSlogan}>
          <span
            role="tooltip"
            id="ln-chat-tip"
            className="ln-flag pointer-events-none absolute right-[calc(100%+14px)] hidden w-max max-w-[260px] rounded-2xl bg-ln-inverse px-4 py-2.5 text-[0.9375rem] leading-5 font-medium text-white shadow-lg sm:block"
          >
            {t.slogans[slogan]}
          </span>
          <a
            href={chatHref}
            target="_blank"
            rel="noopener noreferrer"
            data-cta="whatsapp"
            aria-label={t.chat}
            aria-describedby="ln-chat-tip"
            className="ln-focus ln-fab-chat relative flex h-14 w-14 items-center justify-center rounded-full bg-[#1f9e55]! text-white! no-underline shadow-lg hover:bg-[#188a49]!"
          >
            <span className="ln-fab-ping absolute inset-0 rounded-full bg-[#1f9e55]" aria-hidden />
            <Phone size={24} strokeWidth={2} className="relative" aria-hidden />
          </a>
        </div>
      )}
    </div>
  );
}
