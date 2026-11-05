import { act, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
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

  it('различает default, override и effective для модулей; лимиты тарифа — только чтение', async () => {
    await openCard();
    const webinars = moduleRow('WEBINARS');
    expect(within(webinars).getByTestId('module-default-WEBINARS')).toHaveTextContent('Отключён'); // тариф «Базовый»
    expect(screen.getByTestId('module-effective-WEBINARS')).toHaveTextContent('Включён');
    expect(screen.getByTestId('module-effective-WEBINARS')).toHaveTextContent('Индивидуально');
    expect(screen.getByTestId('limit-effective-USERS_COUNT')).toHaveTextContent('150');
    expect(within(screen.getByTestId('limits-section')).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByTestId('limits-section')).toHaveTextContent('Только чтение');
    expect(saveButton()).toBeDisabled();
  });

  it('цена тарифа подставляется автоматически, ручная скидка пересчитывает итог', async () => {
    const calls = capturePatch();
    const { user } = await openCard();
    expect(screen.getByTestId('base-price')).toHaveTextContent(/100\s000 ₸/);
    expect(screen.getByTestId('final-price')).toHaveTextContent(/100\s000 ₸/);
    await user.type(screen.getByLabelText('Ручная скидка'), '15');
    await user.click(screen.getByRole('combobox', { name: 'Тип скидки' }));
    await user.click(await screen.findByTitle('%'));
    expect(screen.getByTestId('final-price')).toHaveTextContent(/85\s000 ₸/);

    await user.click(saveButton());
    expect(await screen.findByTestId('critical-changes')).toHaveTextContent('Итоговая годовая цена');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(calls[0]!.discount).toEqual({ type: 'PERCENT', value: 15 });
    // Изменение условий фиксируется в истории: одна активная запись
    const active = await screen.findAllByTestId('history-row-ACTIVE');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent('Изменение условий');
    expect(active[0]).toHaveTextContent('15 %');
    expect(active[0]).toHaveTextContent(/85\s000 ₸/);
  });

  it('«Продлить подписку» добавляет год и создаёт запись «Продление» в истории', async () => {
    const { user } = await openCard();
    const end = load().organizations[0]!.subscriptionEndDate;
    const before = screen.getAllByTestId(/^history-row-/).length;
    await user.click(screen.getByRole('button', { name: /Продлить подписку/ }));
    const next = dayjs(end).add(1, 'year');
    expect(screen.getByDisplayValue(next.format('DD.MM.YYYY'))).toBeInTheDocument();
    await user.click(saveButton());
    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByTestId(/^history-row-/)).toHaveLength(before + 1));
    const active = screen.getAllByTestId('history-row-ACTIVE');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent('Продление');
    expect(active[0]).toHaveTextContent(`${dayjs(end).add(1, 'day').format('DD.MM.YYYY')} – ${next.format('DD.MM.YYYY')}`);
    expect(screen.getAllByTestId('history-row-COMPLETED').length).toBe(before);
  });

  it('модуль сверх тарифа включается со сроком действия', async () => {
    const calls = capturePatch();
    const { user } = await openCard();
    expect(within(moduleRow('COURSES')).queryByLabelText(/Срок действия/)).not.toBeInTheDocument(); // входит в тариф
    await user.click(within(moduleRow('REPORTS')).getByText('Включён'));
    const picker = within(moduleRow('REPORTS')).getByLabelText('Срок действия модуля «Отчёты»');
    const at = dayjs().add(10, 'day').hour(18).minute(0);
    await user.click(picker);
    await user.type(picker, `${at.format('DD.MM.YYYY HH:mm')}{Enter}`);
    await waitFor(() => expect(screen.getByTestId('module-effective-REPORTS')).toHaveTextContent('Временно'));
    await user.click(saveButton());
    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    const reports = calls[0]!.moduleOverrides.find((m) => m.code === 'REPORTS')!;
    expect(reports.value).toBe(true);
    expect(dayjs(reports.expiresAt).format('DD.MM.YYYY HH:mm')).toBe(at.format('DD.MM.YYYY HH:mm'));
  });

  it('внизу карточки — история подписки и использование ресурсов', async () => {
    await openCard();
    const history = screen.getByTestId('subscription-history');
    expect(within(history).getAllByTestId('history-row-ACTIVE')).toHaveLength(1);
    expect(within(history).getAllByTestId('history-row-COMPLETED').length).toBeGreaterThan(0);
    const usage = screen.getByTestId('org-usage-USERS_COUNT');
    expect(usage).toHaveTextContent('82 из 150 пользователей');
    expect(usage).toHaveTextContent(/Осталось\s*68 пользователей/);
  });

  it('системный модуль нельзя переопределить', async () => {
    await openCard();
    const radios = within(moduleRow('USERS')).getAllByRole('radio');
    radios.forEach((r) => expect(r).toBeDisabled());
  });

  it('индивидуальное включение модуля сохраняется', async () => {
    const calls = capturePatch();
    const { user } = await openCard();
    await user.click(within(moduleRow('REPORTS')).getByText('Включён'));
    expect(screen.getByTestId('module-effective-REPORTS')).toHaveTextContent('Индивидуально');
    expect(screen.getByText('Есть несохранённые изменения')).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    await user.click(saveButton());

    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.moduleOverrides).toContainEqual({ code: 'REPORTS', value: true, expiresAt: null });
    expect(calls[0]!.version).toBe(1);
    await waitFor(() => expect(screen.getByText('Изменений нет')).toBeInTheDocument());
  });

  it('возврат override к значению тарифа (с подтверждением отключения модуля)', async () => {
    const calls = capturePatch();
    const { user } = await openCard();
    await user.click(within(moduleRow('WEBINARS')).getByRole('radio', { name: 'Отключён' })); // = значению тарифа
    expect(screen.getByTestId('module-effective-WEBINARS')).toHaveTextContent('Отключён');

    await user.click(saveButton());
    const list = await screen.findByTestId('critical-changes');
    expect(list).toHaveTextContent('Будут отключены модули: Вебинары');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));

    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(calls[0]!.moduleOverrides).toContainEqual({ code: 'WEBINARS', value: null, expiresAt: null });
  });

  it('скидка больше 100 % блокирует сохранение', async () => {
    const { user } = await openCard();
    await user.click(screen.getByRole('combobox', { name: 'Тип скидки' }));
    await user.click(await screen.findByTitle('%'));
    await user.type(screen.getByLabelText('Ручная скидка'), '120');
    expect(await screen.findByText('Скидка в процентах — не больше 100')).toBeInTheDocument();
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
    expect(preview).toHaveTextContent('индивидуальные настройки: 1');
    expect(within(preview).getByTestId('new-tariff-price')).toHaveTextContent(/300\s000 ₸/);
    await user.click(within(preview).getByRole('button', { name: 'Применить тариф' }));

    expect(screen.getByText(/Будет изменён с «Базовый»/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('module-effective-CERTIFICATES')).toHaveTextContent('Включён'));
    await user.click(saveButton());
    expect(await screen.findByTestId('critical-changes')).toHaveTextContent('Смена тарифа: «Базовый» → «Бизнес»');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(await screen.findByText('Изменения сохранены')).toBeInTheDocument();
    expect(calls[0]!.tariffPlanId).toBe('a1f0c3d2-0003-4a00-9000-000000000003');
    // Смена тарифа фиксирует цену и лимиты нового тарифа и создаёт запись в истории
    await waitFor(() => expect(screen.getAllByTestId('history-row-ACTIVE')[0]).toHaveTextContent('Смена тарифа'));
    expect(screen.getAllByTestId('history-row-ACTIVE')[0]).toHaveTextContent('Бизнес');
    expect(screen.getByTestId('limit-effective-USERS_COUNT')).toHaveTextContent('1 000');
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
