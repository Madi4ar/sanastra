import { App, Button, Result, Spin } from 'antd';
import { Clock3, LogOut, ShieldX } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useLogout } from '@/auth/auth';
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
  const Icon = expired ? Clock3 : ShieldX;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Result
        icon={<Icon size={64} className={`mx-auto ${expired ? 'text-warning' : 'text-error'}`} aria-hidden />}
        title={expired ? 'Срок действия подписки истёк' : 'Доступ организации временно приостановлен'}
        subTitle="Обратитесь к администратору вашей организации для продления или возобновления подписки."
        extra={
          <Button icon={<LogOut size={16} />} onClick={() => logout.mutate()}>
            Выйти
          </Button>
        }
      />
    </div>
  );
}
