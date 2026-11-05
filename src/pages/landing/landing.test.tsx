import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { loginAs, renderApp } from '@/test/utils';

describe('Лендинг Sanastra', () => {
  it('публичная страница: бренд, слоган, навигация и CTA ведут во вход', async () => {
    renderApp('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Саналы білім.Тұрақты даму.');
    expect(document.documentElement.lang).toBe('kk');
    const nav = screen.getByRole('navigation', { name: 'Негізгі навигация' });
    ['Мүмкіндіктер', 'Оқу', 'Аналитика', 'Ұйымдарға', 'Бағалар'].forEach((l) =>
      expect(within(nav).getByRole('link', { name: l })).toBeInTheDocument(),
    );
    screen.getAllByRole('link', { name: /Тегін бастау/ }).forEach((l) => expect(l).toHaveAttribute('href', '/login'));
    expect(screen.getByRole('link', { name: 'Кіру' })).toHaveAttribute('href', '/login');
  });

  it('все секции из ТЗ на месте, Enterprise — «Жеке ұсыныс»', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    [
      'Оқу процесінің бәрі — бір жерде',
      'Оқу жолы',
      'Дерекке сүйеніп шешім қабылдаңыз',
      'Оқытушыға — қарапайым жұмыс ортасы',
      'Білім алушыға — бәрі түсінікті',
      'Оқу әрқашан жаныңызда',
      'Қолданыстағы жүйелермен бірге жұмыс істейді',
      'Деректер қауіпсіздігі — басты орында',
      'Бір курсқа да, үлкен ұйымға да',
      'Сізге сай жоспарды таңдаңыз',
      'Саналы білімге бүгін қадам жасаңыз',
    ].forEach((h) => expect(screen.getByRole('heading', { level: 2, name: h })).toBeInTheDocument());
    expect(within(screen.getByRole('article', { name: 'Enterprise тарифі' })).getByText('Жеке ұсыныс')).toBeInTheDocument();
    expect(screen.getByText('© 2026 Sanastra. Барлық құқықтар қорғалған.')).toBeInTheDocument();
  });

  it('вошедший пользователь видит переход в кабинет', async () => {
    loginAs('ORGANIZATION_ADMIN');
    renderApp('/');
    expect(await screen.findByRole('link', { name: 'Кабинетке өту' })).toHaveAttribute('href', '/academy/dashboard');
  });
});

describe('Страница входа', () => {
  it('логотип ведёт на главную (лендинг)', async () => {
    const { user, router } = renderApp('/login');
    const logos = await screen.findAllByRole('link', { name: 'Sanastra — на главную' });
    expect(logos[0]).toHaveAttribute('href', '/');
    await user.click(logos[0]!);
    expect(router.state.location.pathname).toBe('/');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Саналы білім.');
  });
});
