import { App, Button, Result, Spin } from 'antd';
import { Clock3, CreditCard, LogOut, ShieldX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useCurrentUser, useLogout } from '@/auth/auth';
import { PaymentModal } from '@/features/tenant-admin/PaymentModal';
import { useCabinet } from '@/features/tenant/cabinet';
import { useTenantAccess } from '@/features/tenant/queries';

/**
 * Служебная страница: без внутренних ID и технических деталей.
 * Real-time соединение остаётся активным (TenantShell): после восстановления подписки
 * пользователь возвращается в кабинет без повторного входа.
 */
export function SubscriptionBlockedPage() {
  const { clientSlug, base } = useCabinet();
  const access = useTenantAccess(clientSlug);
  const { data: user } = useCurrentUser();
  const [paying, setPaying] = useState(false);
  const logout = useLogout();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const status = access.data?.subscriptionStatus;

  useEffect(() => {
    if (status !== 'ACTIVE') return;
    message.success({ key: 'access-restored', content: 'Доступ восстановлен' });
    navigate(base, { replace: true });
  }, [status, base, navigate, message]);

  if (access.isPending || status === 'ACTIVE') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  const expired = status === 'EXPIRED';
  // Истёкшую подписку администратор оплачивает сам; приостановленную возобновляет только Sanastra
  const canPay = expired && user?.role === 'ORGANIZATION_ADMIN';
  const Icon = expired ? Clock3 : ShieldX;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Result
        icon={<Icon size={64} className={`mx-auto ${expired ? 'text-warning' : 'text-error'}`} aria-hidden />}
        title={expired ? 'Срок действия подписки истёк' : 'Доступ организации временно приостановлен'}
        subTitle={
          canPay
            ? 'Оплатите подписку, чтобы сразу восстановить доступ для всей организации.'
            : 'Обратитесь к администратору вашей организации для продления или возобновления подписки.'
        }
        extra={[
          ...(canPay
            ? [
                <Button key="pay" type="primary" icon={<CreditCard size={16} />} onClick={() => setPaying(true)}>
                  Оплатить / Продлить
                </Button>,
              ]
            : []),
          <Button key="logout" icon={<LogOut size={16} />} onClick={() => logout.mutate()}>
            Выйти
          </Button>,
        ]}
      />
      {paying && <PaymentModal clientSlug={clientSlug} onClose={() => setPaying(false)} />}
    </div>
  );
}
