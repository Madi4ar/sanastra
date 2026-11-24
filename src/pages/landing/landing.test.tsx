import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginAs, renderApp } from '@/test/utils';

afterEach(() => {
  window.dataLayer = [];
});

const events = () => (window.dataLayer ?? []).map((e) => e.event);

describe('Лендинг Zuie', () => {
  it('первый экран: ценность, навигация; «Тегін бастау» — регистрация, «Жүйеге кіру» — вход', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Оқу процесін бір жүйеде басқарыңыз');
    expect(document.documentElement.lang).toBe('kk');
    expect(document.title).toBe('Zuie — оқу процесін басқаруға арналған платформа');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `${window.location.origin}/`);
    const nav = screen.getByRole('navigation', { name: 'Негізгі навигация' });
    ['Мүмкіндіктер', 'Қалай жұмыс істейді', 'Кімге арналған', 'Тарифтер', 'Сұрақтар'].forEach((l) =>
      expect(within(nav).getByRole('link', { name: l })).toBeInTheDocument(),
    );
    screen.getAllByRole('link', { name: /^Тегін бастау/ }).forEach((l) => expect(l.getAttribute('href')).toMatch(/^\/register/));
    screen.getAllByRole('link', { name: 'Жүйеге кіру' }).forEach((l) => expect(l).toHaveAttribute('href', '/login'));
    expect(screen.getAllByText('Демонстрациялық деректер').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Sanastra/)).not.toBeInTheDocument();
  });

  it('все секции на месте; 3 тарифа, «Стандарт» рекомендован; неподтверждённые блоки скрыты', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    [
      'Бірнеше жүйенің орнына — бір платформа',
      'Оқу процесінің бәрі — бір жерде',
      'Zuie-мен жұмысты бастау оңай',
      'Оқу жолы',
      'Әкімшіге — бүкіл ұйым бір кабинетте',
      'Оқытушыға — қарапайым жұмыс ортасы',
      'Білім алушыға — бәрі түсінікті',
      'Дерекке сүйеніп шешім қабылдаңыз',
      'Қолданыстағы жүйелермен бірге жұмыс істейді',
      'Іске қосу кезінде жалғыз қалмайсыз',
      'Бір курсқа да, үлкен ұйымға да',
      'Сізге сай жоспарды таңдаңыз',
      'Жиі қойылатын сұрақтар',
      'Оқу процесін бір жүйеге біріктіруге дайынсыз ба?',
    ].forEach((h) => expect(screen.getByRole('heading', { level: 2, name: h })).toBeInTheDocument());
    // Без подтверждённых данных: нет цифр, логотипов и кейсов — только нейтральная строка доверия
    ['Zuie нақты сандармен', 'Zuie-ді таңдаған ұйымдар', 'Zuie ұйымдарға қандай нәтиже береді'].forEach((h) =>
      expect(screen.queryByRole('heading', { name: h })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Оқу орталықтары, мектептер және компаниялар үшін жасалған')).toBeInTheDocument();

    const popular = screen.getByRole('article', { name: 'Стандарт тарифі, ұсынылады' });
    expect(popular).toHaveTextContent('200 000 ₸');
    ['Базалық', 'Бизнес', 'Ұйым'].forEach((n) => expect(screen.getByRole('article', { name: `${n} тарифі` })).toBeInTheDocument());
    expect(screen.getAllByText('Жоспарда').length).toBeGreaterThan(0);
    expect(screen.getByText(`© ${new Date().getFullYear()} Zuie. Барлық құқықтар қорғалған.`)).toBeInTheDocument();
    expect(screen.getByText('Әзірлеген: CPM NIS')).toBeInTheDocument();
  });

  it('FAQ — доступный аккордеон, открытие отправляет событие', async () => {
    const { user } = renderApp('/');
    const q = await screen.findByRole('button', { name: 'Платформаны тегін сынап көруге бола ма?' });
    expect(q).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(q.getAttribute('aria-controls')!)!;
    expect(panel).not.toBeVisible();
    await user.click(q);
    expect(q).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(window.dataLayer).toContainEqual({ event: 'landing_faq_open', question_id: 'trial' });
  });

  it('форма демо: проверка полей, успех без персональных данных в аналитике', async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, set href(v: string) { assign(v); } } });
    try {
      const { user } = renderApp('/');
      await screen.findByRole('heading', { level: 1 });
      const form = screen.getByRole('form', { name: 'Жеке демо сұрау' });
      await user.click(within(form).getByRole('button', { name: 'Өтінім жіберу' }));
      expect(within(form).getByText('Атыңызды жазыңыз')).toBeInTheDocument();
      expect(within(form).getByLabelText('Атыңыз')).toHaveFocus();

      await user.type(within(form).getByLabelText('Атыңыз'), 'Айгерім');
      await user.type(within(form).getByLabelText('Ұйым'), 'Білім орталығы');
      await user.type(within(form).getByLabelText('Телефон немесе email'), 'aigerim@example.kz');
      await user.click(within(form).getByLabelText('Дербес деректерді өңдеу саясатымен келісемін'));
      await user.click(within(form).getByRole('button', { name: 'Өтінім жіберу' }));

      expect(await screen.findByRole('heading', { name: 'Рақмет! Өтінім дайын' })).toHaveFocus();
      expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^mailto:hello@zuie\.kz\?/));
      expect(events()).toEqual(expect.arrayContaining(['landing_demo_open', 'landing_demo_submit']));
      expect(JSON.stringify(window.dataLayer)).not.toMatch(/Айгерім|aigerim/);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('клик по CTA отправляет landing_cta_click с местом и целью', async () => {
    const { user } = renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('link', { name: 'Енгізу туралы кеңес алу' })[0]!);
    expect(window.dataLayer).toContainEqual({ event: 'landing_cta_click', placement: 'support', label: 'Енгізу туралы кеңес алу', target: '#demo' });
    expect(window.dataLayer).toContainEqual({ event: 'landing_demo_open', placement: 'support' });
  });

  it('вошедший пользователь видит переход в кабинет', async () => {
    loginAs('ORGANIZATION_ADMIN');
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Кабинетке өту' })).toHaveAttribute('href', '/academy/admin');
  });
});

describe('Страница входа', () => {
  it('логотип ведёт на главную (лендинг)', async () => {
    const { user, router } = renderApp('/login');
    const logos = await screen.findAllByRole('link', { name: 'Sanastra — на главную' });
    expect(logos[0]).toHaveAttribute('href', '/');
    await user.click(logos[0]!);
    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Оқу процесін бір жүйеде басқарыңыз');
  });
});
