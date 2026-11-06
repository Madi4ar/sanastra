import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Input, Modal, Radio, Result, Select, Skeleton } from 'antd';
import { CreditCard } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { PaymentPeriod } from '@/api/types';
import { Field } from '@/shared/FormField';
import { formatDate } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { formatKzt } from '@/shared/pricing';

/** Тестовый номер, на котором эквайринг отклоняет платёж */
const DECLINED_CARD = '4000000000000002';

function luhn(digits: string): boolean {
  let sum = 0;
  [...digits].reverse().forEach((c, i) => {
    let n = Number(c);
    if (i % 2) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  });
  return digits.length >= 13 && sum % 10 === 0;
}

function expiryValid(v: string): boolean {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);
  if (!m) return false;
  const now = new Date();
  const year = 2000 + Number(m[2]);
  return year > now.getFullYear() || (year === now.getFullYear() && Number(m[1]) >= now.getMonth() + 1);
}

/**
 * «Оплатить / Продлить»: выбор тарифа и периода, оплата картой.
 * Данные карты остаются в браузере: на сервер уходит только результат эквайринга.
 */
export function PaymentModal({
  clientSlug,
  initialTariffId,
  onClose,
}: {
  clientSlug: string;
  /** Тариф, выбранный в промо-окне демо-модуля */
  initialTariffId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const billing = useQuery({ queryKey: queryKeys.tenantBilling(clientSlug), queryFn: admin.billing });
  const [tariffId, setTariffId] = useState(initialTariffId);
  const [period, setPeriod] = useState<PaymentPeriod>('YEAR');
  const [step, setStep] = useState<'choose' | 'card'>('choose');
  const [card, setCard] = useState({ number: '', holder: '', expiry: '', cvc: '' });
  const [tried, setTried] = useState(false);
  const [paidUntil, setPaidUntil] = useState<string | null>(null);

  const tariffs = billing.data?.tariffs ?? [];
  const tariff = tariffs.find((t) => t.id === tariffId) ?? tariffs.find((t) => t.isCurrent);
  const amount = tariff ? (period === 'YEAR' ? tariff.finalPrice : tariff.monthlyPrice) : 0;

  const digits = card.number.replace(/\D/g, '');
  const cardErrors = {
    number: luhn(digits) ? undefined : 'Проверьте номер карты',
    holder: card.holder.trim().length >= 2 ? undefined : 'Укажите имя владельца',
    expiry: expiryValid(card.expiry) ? undefined : 'Срок в формате ММ/ГГ, карта не должна быть просрочена',
    cvc: /^\d{3}$/.test(card.cvc) ? undefined : '3 цифры',
  };

  const pay = useMutation({
    mutationFn: async () => {
      const order = await admin.createPayment(tariff!.id, period);
      return admin.completePayment(order.id, digits === DECLINED_CARD ? 'DECLINED' : 'SUCCESS');
    },
    onSuccess: (data) => {
      setPaidUntil(data.subscriptionEndDate);
      setCard({ number: '', holder: '', expiry: '', cvc: '' });
      qc.setQueryData(queryKeys.tenantBilling(clientSlug), data);
      // Доступ к модулям активируется сразу
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAccess(clientSlug) });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantModules(clientSlug) });
      void qc.invalidateQueries({ queryKey: queryKeys.subscriptionSummary(clientSlug) });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      void qc.invalidateQueries({ queryKey: queryKeys.moduleCatalog(clientSlug) });
      void qc.invalidateQueries({ queryKey: queryKeys.me });
    },
    onError: (e) => {
      if (!isApiError(e)) message.error('Не удалось выполнить оплату');
    },
  });

  const submit = () => {
    setTried(true);
    if (Object.values(cardErrors).some(Boolean)) return;
    pay.mutate();
  };
  const shown = (e: string | undefined) => (tried ? e : undefined);

  const footer = paidUntil
    ? [
        <Button key="done" type="primary" onClick={onClose}>
          Готово
        </Button>,
      ]
    : step === 'choose'
      ? [
          <Button key="cancel" onClick={onClose}>
            Отмена
          </Button>,
          <Button key="next" type="primary" disabled={!tariff} onClick={() => setStep('card')}>
            Перейти к оплате
          </Button>,
        ]
      : [
          <Button key="back" disabled={pay.isPending} onClick={() => setStep('choose')}>
            Назад
          </Button>,
          <Button key="pay" type="primary" icon={<CreditCard size={16} />} loading={pay.isPending} onClick={submit}>
            Оплатить {formatKzt(amount)}
          </Button>,
        ];

  return (
    <Modal open width={620} title="Оплата подписки" footer={footer} onCancel={onClose} maskClosable={false} destroyOnHidden>
      {billing.isPending ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : billing.isError ? (
        <ErrorState error={billing.error} onRetry={() => void billing.refetch()} />
      ) : paidUntil ? (
        <Result
          status="success"
          title="Оплата прошла успешно"
          subTitle={`Тариф «${billing.data.tariffName}» действует до ${formatDate(paidUntil)}. Доступ к модулям уже обновлён.`}
        />
      ) : step === 'choose' ? (
        <div className="flex flex-col gap-4 pt-2">
          <Field label="Тариф" htmlFor="pay-tariff">
            <Select
              id="pay-tariff"
              aria-label="Тариф"
              className="w-full"
              style={{ width: '100%' }}
              value={tariff?.id}
              onChange={setTariffId}
              options={tariffs.map((t) => ({ value: t.id, label: t.isCurrent ? `${t.name} (текущий)` : `Перейти на «${t.name}»` }))}
            />
          </Field>
          {tariff && !tariff.isCurrent && (
            <Alert
              type="info"
              showIcon
              title={`Модули тарифа: ${tariff.modules.join(', ')}`}
              description="Новый тариф начнёт действовать с даты оплаты. Остаток текущего периода не переносится."
            />
          )}
          <Radio.Group
            aria-label="Период оплаты"
            className="flex flex-col gap-2"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PaymentPeriod)}
          >
            <Radio value="YEAR" data-testid="period-year">
              <span className="font-medium">Оплата за 1 год сразу</span> — {tariff && formatKzt(tariff.finalPrice)}
            </Radio>
            <Radio value="MONTH" data-testid="period-month">
              <span className="font-medium">Помесячная оплата</span> — {tariff && formatKzt(tariff.monthlyPrice)} в месяц
              <span className="block text-xs text-muted">Годовая цена / 12. Подписка продлевается на 1 месяц.</span>
            </Radio>
          </Radio.Group>
          {tariff && tariff.annualPrice !== tariff.finalPrice && (
            <p className="m-0 text-xs text-muted">
              Базовая годовая цена {formatKzt(tariff.annualPrice)}, в расчёте учтена индивидуальная скидка.
            </p>
          )}
        </div>
      ) : (
        <form
          className="flex flex-col gap-4 pt-2"
          aria-label="Данные карты"
          noValidate
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Alert
            type="warning"
            showIcon
            title="Тестовая оплата: деньги не списываются"
            description="Настоящий эквайринг ещё не подключён, данные карты никуда не отправляются. Используйте номер 4242 4242 4242 4242; номер 4000 0000 0000 0002 имитирует отказ банка."
          />
          {pay.isError && <Alert type="error" showIcon title={pay.error.message} />}
          <Field label="Номер карты" htmlFor="card-number" required error={shown(cardErrors.number)}>
            <Input
              id="card-number"
              inputMode="numeric"
              autoComplete="off"
              maxLength={19}
              placeholder="0000 0000 0000 0000"
              value={card.number}
              status={shown(cardErrors.number) ? 'error' : undefined}
              onChange={(e) =>
                setCard({ ...card, number: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') })
              }
            />
          </Field>
          <Field label="Владелец карты" htmlFor="card-holder" required error={shown(cardErrors.holder)}>
            <Input id="card-holder" autoComplete="off" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Срок действия" htmlFor="card-expiry" required error={shown(cardErrors.expiry)}>
              <Input
                id="card-expiry"
                autoComplete="off"
                placeholder="ММ/ГГ"
                maxLength={5}
                value={card.expiry}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setCard({ ...card, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d });
                }}
              />
            </Field>
            <Field label="CVC" htmlFor="card-cvc" required error={shown(cardErrors.cvc)}>
              <Input.Password
                id="card-cvc"
                autoComplete="off"
                inputMode="numeric"
                maxLength={3}
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '') })}
              />
            </Field>
          </div>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
