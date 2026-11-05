import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, type RouteObject } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { HomeRedirect, RequireAuth } from '@/auth/auth';
import { AppLayout, type CrumbHandle } from '@/layout/AppLayout';
import { LandingPage } from '@/pages/landing/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { OrganizationDetailPage } from '@/pages/OrganizationDetailPage';
import { OrganizationsPage } from '@/pages/OrganizationsPage';
import { ForbiddenPage, NotFoundPage } from '@/pages/StatusPages';
import { RequireOrganizationAdmin } from '@/features/tenant/access';
import { DashboardPage } from '@/pages/tenant/DashboardPage';
import { FeatureUnavailablePage, ModulePage, ProfilePage } from '@/pages/tenant/MiscPages';
import { ModulesPage, OrganizationInfoPage, SubscriptionPage, UsagePage } from '@/pages/tenant/OrganizationPages';
import { SubscriptionBlockedPage } from '@/pages/tenant/SubscriptionBlockedPage';
import { TenantLayout } from '@/pages/tenant/TenantLayout';
import { TenantShell } from '@/pages/tenant/TenantShell';

function OrganizationCrumb({ tenantId }: { tenantId: string }) {
  const { data } = useQuery({
    queryKey: queryKeys.organization(tenantId),
    queryFn: () => api.organizations.get(tenantId),
    retry: false,
  });
  return <>{data?.name ?? 'Карточка организации'}</>;
}

const crumb = (title: string) => ({ crumb: () => title }) satisfies CrumbHandle;

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/app', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/403', element: <ForbiddenPage /> },
  {
    path: '/superadmin',
    element: (
      <RequireAuth role="SUPERADMIN">
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="organizations" replace /> },
      {
        path: 'organizations',
        handle: { crumb: () => 'Организации' } satisfies CrumbHandle,
        children: [
          { index: true, element: <OrganizationsPage /> },
          {
            path: ':tenantId',
            element: <OrganizationDetailPage />,
            handle: {
              crumb: (p) => <OrganizationCrumb tenantId={p.tenantId ?? ''} />,
            } satisfies CrumbHandle,
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/:clientSlug',
    element: (
      <RequireAuth>
        <TenantShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'subscription-blocked', element: <SubscriptionBlockedPage /> },
      {
        element: <TenantLayout />,
        children: [
          { path: 'dashboard', element: <DashboardPage /> },
          {
            path: 'organization',
            handle: crumb('Организация'),
            element: (
              <RequireOrganizationAdmin>
                <Outlet />
              </RequireOrganizationAdmin>
            ),
            children: [
              { index: true, element: <OrganizationInfoPage /> },
              { path: 'subscription', element: <SubscriptionPage />, handle: crumb('Тариф и подписка') },
              { path: 'modules', element: <ModulesPage />, handle: crumb('Модули') },
              { path: 'usage', element: <UsagePage />, handle: crumb('Лимиты и использование') },
            ],
          },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'feature-unavailable', element: <FeatureUnavailablePage /> },
          { path: 'm/:moduleCode', element: <ModulePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];
