import { Button, Tooltip } from 'antd';
import { LogOut } from 'lucide-react';
import { useMemo } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router';
import { useCurrentUser, useLogout } from '@/auth/auth';
import { RoleSwitcher } from '@/features/auth/roles';
import { CabinetProvider } from '@/features/tenant/cabinet';
import { ProfileCard } from './MiscPages';
import { PageHeader } from './PageHeader';
import { TenantShell } from './TenantShell';

/** Интерфейс администратора организации: /{client_slug}/admin. */
export function AdminCabinet() {
  const { clientSlug = '' } = useParams();
  const { data: user } = useCurrentUser();
  const value = useMemo(() => ({ clientSlug, base: `/${clientSlug}/admin` }), [clientSlug]);
  if (user?.clientSlug !== clientSlug) return <Navigate to="/403" replace />;
  return (
    <CabinetProvider value={value}>
      <TenantShell />
    </CabinetProvider>
  );
}

/** Интерфейс Слушателя (/learn), Тренера (/trainer) или кастомной роли (/workspace) в организации активной роли. */
export function RoleCabinet({ base }: { base: '/learn' | '/trainer' | '/workspace' }) {
  const { data: user } = useCurrentUser();
  const clientSlug = user?.clientSlug;
  const value = useMemo(() => ({ clientSlug: clientSlug ?? '', base }), [clientSlug, base]);
  if (!clientSlug) return <PersonalCabinet base={base} />;
  return (
    <CabinetProvider value={value}>
      <TenantShell />
    </CabinetProvider>
  );
}

/** Слушатель без организации (сразу после регистрации): личный кабинет с профилем. */
function PersonalCabinet({ base }: { base: string }) {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const location = useLocation();
  const profile = `${base}/profile`;
  if (!user) return null;
  if (location.pathname !== profile) return <Navigate to={profile} replace />;
  return (
    <div className="min-h-screen bg-page">
      <header className="flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
        <Link to="/" aria-label="Sanastra — на главную" className="focus-ring flex items-center gap-2 rounded-md text-text! no-underline">
          <img src="/brand/sanastra-icon-64.png" width={32} height={32} alt="" className="rounded-lg" />
          <span className="text-lg font-semibold">Sanastra</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <RoleSwitcher />
          <Tooltip title="Выйти">
            <Button aria-label="Выйти" icon={<LogOut size={16} />} loading={logout.isPending} onClick={() => logout.mutate()} />
          </Tooltip>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <PageHeader title="Профиль" />
        <ProfileCard user={user} />
      </main>
    </div>
  );
}
