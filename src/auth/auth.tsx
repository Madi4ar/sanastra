import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Spin } from 'antd';
import type { ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { api } from '@/api/endpoints';
import { isApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import type { CurrentUser, Role } from '@/api/types';

/** Текущий пользователь. `null` — не авторизован (401). */
export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (e) {
        if (isApiError(e) && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: api.auth.logout,
    onSettled: () => {
      qc.clear();
      qc.setQueryData(queryKeys.me, null);
      navigate('/login', { replace: true });
    },
  });
}

export const homeFor = (user: CurrentUser) =>
  user.role === 'SUPERADMIN' ? '/superadmin/organizations' : `/${user.clientSlug ?? ''}/dashboard`;

function FullPageSpin() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spin size="large" description="Загрузка…" />
    </div>
  );
}

/**
 * Клиентская проверка доступа — только UX. Все операции повторно проверяются на бэкенде.
 */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { data: user, isPending, isError } = useCurrentUser();
  const location = useLocation();
  if (isPending) return <FullPageSpin />;
  if (isError || !user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  if (role && user.role !== role) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

export function HomeRedirect() {
  const { data: user, isPending } = useCurrentUser();
  if (isPending) return <FullPageSpin />;
  return <Navigate to={user ? homeFor(user) : '/login'} replace />;
}
