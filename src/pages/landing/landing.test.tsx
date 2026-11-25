import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginAs, renderApp } from '@/test/utils';

afterEach(() => {
  window.dataLayer = [];
});

const events = () => (window.dataLayer ?? []).map((e) => e.event);

describe('Лендинг Zhuie', () => {
  it('первый экран: ценность, навигация; «Тегін бастау» и «Демо көру» — к форме демо, «Жүйеге кіру» — вход', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Zhuie — оқу процесін бір жүйеде басқарыңыз');
    expect(document.documentElement.lang).toBe('kk');
    expect(document.title).toBe('Zhuie — оқу процесін басқаруға арналған платформа');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `${window.location.origin}/`);
    const nav = screen.getByRole('navigation', { name: 'Негізгі навигация' });
    ['Мүмкіндіктер', 'Қалай жұмыс істейді', 'Кімге арналған', 'Тарифтер', 'Сұрақтар'].forEach((l) =>
      expect(within(nav).getByRole('link', { name: l })).toBeInTheDocument(),
    );
    // «Тегін бастау» и «Демо көру» ведут вниз, к форме заявки
    screen.getAllByRole('link', { name: /^Тегін бастау/ }).forEach((l) => expect(l).toHaveAttribute('href', '#demo'));
    screen.getAllByRole('link', { name: /^Демо көру/ }).forEach((l) => expect(l).toHaveAttribute('href', '#demo'));
    screen.getAllByRole('link', { name: 'Жүйеге кіру' }).forEach((l) => expect(l).toHaveAttribute('href', '/login'));
    expect(screen.queryByText(/емонстрациялық деректер/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sanastra/)).not.toBeInTheDocument();
  });

  it('русская версия: локализует страницу, SEO и позволяет перейти на казахскую', async () => {
    const { user, router } = renderApp('/ru');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Zhuie — управляйте учебным процессом в одной системе');
    expect(document.documentElement.lang).toBe('ru');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', `${window.location.origin}/ru`);

    const nav = screen.getByRole('navigation', { name: 'Основная навигация' });
    ['Возможности', 'Как это работает', 'Для кого', 'Тарифы', 'Вопросы'].forEach((label) =>
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument(),
    );
    screen.getAllByRole('link', { name: /^Начать бесплатно/ }).forEach((link) => expect(link).toHaveAttribute('href', '#demo'));
    expect(screen.queryByRole('heading', { name: 'Оқу процесінің бәрі — бір платформада' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Жиі қойылатын сұрақтар' })).not.toBeInTheDocument();

    const kazakhLinks = screen.getAllByRole('link', { name: 'Қаз' });
    kazakhLinks.forEach((link) => expect(link).toHaveAttribute('href', '/'));
    await user.click(kazakhLinks[0]!);
    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Zhuie — оқу процесін бір жүйеде басқарыңыз');
    expect(document.documentElement.lang).toBe('kk');
  });

  it('все секции на месте; 3 тарифа, «Стандарт» рекомендован; неподтверждённые блоки скрыты', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    [
      'Бірнеше жүйенің орнына — бір платформа',
      'Оқу процесінің бәрі — бір платформада',
      'Zhuie-мен жұмысты бастау оңай',
      'Әр рөлге — өз жұмыс орны',
      'Дерекке сүйеніп шешім қабылдаңыз',
      'Қолданыстағы жүйелермен бірге жұмыс істейді',
      'Іске қосу кезінде жалғыз қалмайсыз',
      'Бір курсқа да, үлкен ұйымға да',
      'Сізге сай жоспарды таңдаңыз',
      'Жиі қойылатын сұрақтар',
      'Оқу процесін бір жүйеге біріктіруге дайынсыз ба?',
    ].forEach((h) => expect(screen.getByRole('heading', { level: 2, name: h })).toBeInTheDocument());
    // Без подтверждённых данных: нет цифр, логотипов и кейсов — только нейтральная строка доверия
    ['Zhuie нақты сандармен', 'Zhuie-ді таңдаған ұйымдар', 'Zhuie ұйымдарға қандай нәтиже береді'].forEach((h) =>
      expect(screen.queryByRole('heading', { name: h })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Оқу орталықтары, мектептер және компаниялар үшін жасалған')).toBeInTheDocument();

    const popular = screen.getByRole('article', { name: 'Стандарт тарифі, ұсынылады' });
    expect(popular).toHaveTextContent('200 000 ₸');
    ['Базалық', 'Бизнес', 'Ұйым'].forEach((n) => expect(screen.getByRole('article', { name: `${n} тарифі` })).toBeInTheDocument());
    expect(screen.getAllByText('Жоспарда').length).toBeGreaterThan(0);
    expect(screen.getByText(`© ${new Date().getFullYear()} Zhuie. Барлық құқықтар қорғалған.`)).toBeInTheDocument();
    // Подвал: «Zhuie · Beyim Ustaz әзірлеген», Beyim Ustaz — внешняя ссылка
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Zhuie · Beyim Ustaz әзірлеген');
    screen.getAllByRole('link', { name: 'Телефон: +7 (7172) 69-74-14' }).forEach((l) => expect(l).toHaveAttribute('href', 'tel:+77172697414'));
  });

  it('подпись Beyim Ustaz: в шапке, на первом экране и в подвале ведёт на beyim.edu.kz и считается в аналитике', async () => {
    const { user } = renderApp('/');
    expect(await screen.findByText('әзірлеген білім беру платформасы', { exact: false })).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Beyim Ustaz' });
    expect(links).toHaveLength(3);
    links.forEach((l) => {
      expect(l).toHaveAttribute('href', 'https://beyim.edu.kz/');
      expect(l).toHaveAttribute('target', '_blank');
      expect(l).toHaveAttribute('rel', 'noopener noreferrer');
    });
    links.forEach((l) => l.addEventListener('click', (e) => e.preventDefault()));
    await user.click(links[0]!);
    expect(window.dataLayer).toContainEqual({ event: 'beyim_ustaz_click', placement: 'header' });
  });

  it('возможности — вкладки: ARIA-связи, клавиатура (стрелки, Home/End), неактивные панели вне порядка Tab', async () => {
    const { user } = renderApp('/');
    const list = await screen.findByRole('tablist', { name: 'Платформа мүмкіндіктері' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    const panel = document.getElementById(tabs[0]!.getAttribute('aria-controls')!)!;
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0]!.id);
    expect(panel).toHaveTextContent('Курсты өз құрылымыңызға сай құрыңыз');
    expect(document.getElementById(tabs[1]!.getAttribute('aria-controls')!)).toHaveAttribute('inert');

    await user.click(tabs[2]!);
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(window.dataLayer).toContainEqual({ event: 'features_tab_view', tab_id: 'assignments', input: 'click' });

    await user.keyboard('{ArrowRight}');
    expect(tabs[3]).toHaveFocus();
    expect(tabs[3]).toHaveAttribute('aria-selected', 'true');
    expect(window.dataLayer).toContainEqual({ event: 'features_tab_view', tab_id: 'roles', input: 'keyboard' });
    await user.keyboard('{End}');
    expect(tabs[5]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveFocus();

    // Стрелки слайдера: шаг вперёд и индикатор позиции
    await user.click(screen.getByRole('button', { name: 'Келесі мүмкіндік' }));
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('2 / 6')).toBeInTheDocument();
    expect(window.dataLayer).toContainEqual({ event: 'features_next_click', from: 'courses', to: 'groups' });
    expect(screen.getByRole('button', { name: 'Алдыңғы мүмкіндік' })).toBeEnabled();
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
      expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^mailto:support@cpm\.kz\?/));
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
    const logos = await screen.findAllByRole('link', { name: 'Zhuie — на главную' });
    expect(logos[0]).toHaveAttribute('href', '/');
    await user.click(logos[0]!);
    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Zhuie — оқу процесін бір жүйеде басқарыңыз');
  });
});
