import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SubscriptionSettingsPayload } from '@/api/types';
import { queryKeys } from '@/api/queryKeys';
import { load } from '@/mocks/db';
import { server } from '@/test/setup';
import { ACADEMY_ID, loginAs, mutateOrg, renderApp } from '@/test/utils';

const CARD = `/superadmin/organizations/${ACADEMY_ID}`;

async function openCard() {
  const r = renderApp(CARD);
  await screen.findByRole('heading', { name: 'Academy' });
  return r;
}

const saveButton = () => screen.getByRole('button', { name: /Сохранить$/ });
const moduleRow = (code: string) => screen.getByTestId(`module-row-${code}`);

function capturePatch() {
  const calls: SubscriptionSettingsPayload[] = [];
  // Сквозной обработчик: запоминает тело и передаёт запрос основному мок-обработчику
  server.use(
    http.patch('*/subscription-settings', async ({ request }) => {
      calls.push((await request.clone().json()) as SubscriptionSettingsPayload);
      return undefined;
    }),
  );
  return calls;
}

describe('Карточка организации', () => {
  beforeEach(() => loginAs('SUPERADMIN'));

  it('показывает основные данные, tenant_id и slug только для чтения', async () => {
    await openCard();
    expect(screen.getByText(ACADEMY_ID)).toBeInTheDocument();
    expect(screen.getAllByText('academy').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('status-tag')[0]).toHaveTextContent('Активна');
    expect(screen.getByRole('button', { name: 'Назад к реестру' })).toBeInTheDocument();
  });

  it('различает default, override и effective для модулей и лимитов', async () => {
    await openCard();
    const webinars = moduleRow('WEBINARS');
    expect(within(webinars).getByTestId('module-default-WEBINARS')).toHaveTextContent('Отключён'); // тариф «Базовый»
    expect(screen.getByTestId('module-effective-WEBINARS')).toHaveTextContent('Включён');
    expect(screen.getByTestId('module-effective-WEBINARS')).toHaveTextContent('Индивидуально');
    expect(screen.getByTestId('limit-effective-USERS_COUNT')).toHaveTextContent('150');
    expect(screen.getByTestId('limit-effective-USERS_COUNT')).toHaveTextContent('Индивидуально');
    expect(screen.getByTestId('limit-effective-COURSES_COUNT')).not.toHaveTextContent('Индивидуально');
    expect(saveButton()).toBeDisabled();
  });

  it('системный модуль нельзя переопределить', async () => {
    await openCard();
    const radios = within(moduleRow('USERS')).getAllByRole('radio');
    radios.forEach((r) => expect(r).toBeDisabled());
  });

  it('индивидуальное включение модуля и изменение лимита сохраняются', async () => {
    const calls = capturePatch();
    const { user } = await openCard();
    await user.click(within(moduleRow('REPORTS')).getByText('Включён'));
    expect(screen.getByTestId('module-effective-REPORTS')).toHaveTextContent('Индивидуально');
    expect(screen.getByText('Есть несохранённые изменения')).toBeInTheDocument();

    const input = screen.getByLabelText('Индивидуальное значение: Количество курсов');
    await user.type(input, '25');
    await waitFor(() => expect(saveButton()).toBeEnabled());
    // Отправка формы Enter из поля (клик после ввода в jsdom аномально медленный; в E2E проверяется клик)
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.moduleOverrides).toContainEqual({ code: 'REPORTS', value: true });
    expect(calls[0]!.limitOverrides).toContainEqual({ code: 'COURSES_COUNT', value: 25 });
    expect(calls[0]!.version).toBe(1);
    await waitFor(() => expect(screen.getByText('Изменений нет')).toBeInTheDocument());
  });

  it('возврат override к значению тарифа (с подтверждением уменьшения лимита)', async () => {
    const calls = capturePatch();
    const { user } = await openCard();
    await user.click(screen.getByRole('button', { name: 'Вернуть значение тарифа для «Количество пользователей»' }));
    expect(screen.getByTestId('limit-effective-USERS_COUNT')).toHaveTextContent('50');
    await user.click(screen.getByRole('button', { name: 'Вернуть значение тарифа для «Вебинары»' }));
    expect(screen.getByTestId('module-effective-WEBINARS')).toHaveTextContent('Отключён');

    await user.click(saveButton());
    const list = await screen.findByTestId('critical-changes');
    expect(list).toHaveTextContent('Будут отключены модули: Вебинары');
    expect(list).toHaveTextContent('Уменьшение лимита «Количество пользователей»: 150 → 50');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(calls[0]!.limitOverrides).toContainEqual({ code: 'USERS_COUNT', value: null });
    expect(calls[0]!.moduleOverrides).toContainEqual({ code: 'WEBINARS', value: null });
  });

  it('невалидный лимит блокирует сохранение', async () => {
    const { user } = await openCard();
    const input = screen.getByLabelText('Индивидуальное значение: Количество курсов');
    await user.type(input, '5000');
    expect(await screen.findByText('Максимум — 1 000')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('смена тарифа: preview, сравнение и подтверждение', async () => {
    const calls = capturePatch();
    const { user } = await openCard();
    await user.click(screen.getByRole('combobox', { name: 'Тарифный план' }));
    await user.click(await screen.findByTitle('Бизнес'));

    const preview = await screen.findByTestId('tariff-preview');
    expect(preview).toHaveTextContent('Базовый');
    expect(preview).toHaveTextContent('Бизнес');
    expect(within(preview).getAllByText('Изменится').length).toBeGreaterThan(0);
    expect(preview).toHaveTextContent('индивидуальные настройки: 2');
    await user.click(within(preview).getByRole('button', { name: 'Применить тариф' }));

    expect(screen.getByText(/Будет изменён с «Базовый»/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('module-effective-CERTIFICATES')).toHaveTextContent('Включён'));
    await user.click(saveButton());
    expect(await screen.findByTestId('critical-changes')).toHaveTextContent('Смена тарифа: «Базовый» → «Бизнес»');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(calls[0]!.tariffPlanId).toBe('a1f0c3d2-0003-4a00-9000-000000000003');
  });

  it('отключение подписки требует подтверждения, ошибка 400 привязывается к полю', async () => {
    server.use(
      http.patch('*/subscription-settings', () =>
        HttpResponse.json(
          { code: 'VALIDATION_ERROR', fieldErrors: { subscriptionStartDate: 'Дата начала вне допустимого периода' } },
          { status: 400 },
        ),
      ),
    );
    const { user } = await openCard();
    await user.click(screen.getByRole('switch'));
    expect(screen.getByTestId('subscription-warnings')).toHaveTextContent('Подписка отключена');
    await user.click(saveButton());
    expect(await screen.findByTestId('critical-changes')).toHaveTextContent('Подписка будет отключена');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(await screen.findByText('Дата начала вне допустимого периода')).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked(); // данные формы не потеряны
  });

  it('409: предлагает загрузить актуальные данные', async () => {
    const { user } = await openCard();
    mutateOrg(ACADEMY_ID, { version: 5, updatedBy: 'SYSTEM_PAYMENT' });
    await user.click(within(moduleRow('CHAT')).getByText('Включён'));
    await user.click(saveButton());
    expect(await screen.findByText('Конфликт версий')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Загрузить актуальные данные' }));
    await waitFor(() => expect(screen.getByText('Изменений нет')).toBeInTheDocument());
    expect(screen.getByTestId('module-effective-CHAT')).toHaveTextContent('Отключён');
  });

  it('500: изменения не теряются, есть «Повторить»', async () => {
    let fail = true;
    server.use(
      http.patch('*/subscription-settings', () => (fail ? HttpResponse.json({}, { status: 500 }) : undefined)),
    );
    const { user } = await openCard();
    await user.click(within(moduleRow('CHAT')).getByText('Включён'));
    await user.click(saveButton());
    expect(await screen.findByText('Изменения не сохранены')).toBeInTheDocument();
    expect(screen.getByTestId('module-effective-CHAT')).toHaveTextContent('Включён');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
  });

  it('внешнее обновление версии: чистая форма обновляется, dirty — показывает предупреждение', async () => {
    const { user, queryClient } = await openCard();
    // чистая форма
    mutateOrg(ACADEMY_ID, { version: 2, updatedBy: 'SYSTEM_PAYMENT', subscriptionEndDate: '2099-12-31' });
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.organization(ACADEMY_ID) }));
    expect(await screen.findByText('Настройки обновлены платёжным сервисом')).toBeInTheDocument();
    expect(screen.getByDisplayValue('31.12.2099')).toBeInTheDocument();

    // dirty-форма
    await user.click(within(moduleRow('CHAT')).getByText('Включён'));
    mutateOrg(ACADEMY_ID, { version: 3, updatedBy: 'SYSTEM_PAYMENT' });
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.organization(ACADEMY_ID) }));
    const alert = await screen.findByTestId('external-update-alert');
    expect(alert).toHaveTextContent('платёжный сервис');
    expect(screen.getByTestId('module-effective-CHAT')).toHaveTextContent('Включён');
  });

  it('уход с dirty-формы запрашивает подтверждение', async () => {
    const { user, router } = await openCard();
    await user.click(within(moduleRow('CHAT')).getByText('Включён'));
    await user.click(screen.getByRole('button', { name: 'Назад к реестру' }));
    expect(await screen.findByText('Есть несохранённые изменения', { selector: '.ant-modal-title' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(CARD);
    await user.click(screen.getByRole('button', { name: 'Уйти без сохранения' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin/organizations'));
  });

  it('404: «Организация не найдена» и возврат в реестр', async () => {
    const { user, router } = renderApp('/superadmin/organizations/unknown-id');
    expect(await screen.findByText('Организация не найдена')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Вернуться в реестр/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/superadmin/organizations'));
  });

  it('403 при сохранении показывает сообщение', async () => {
    server.use(http.patch('*/subscription-settings', () => HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 })));
    const { user } = await openCard();
    await user.click(within(moduleRow('CHAT')).getByText('Включён'));
    await user.click(saveButton());
    expect(await screen.findByText('Недостаточно прав для выполнения операции.')).toBeInTheDocument();
    expect(load().organizations[0]!.version).toBe(1);
  });
});
