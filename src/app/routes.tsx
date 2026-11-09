import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, type RouteObject } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import { HomeRedirect, RequireAuth } from '@/auth/auth';
import { AppLayout, type CrumbHandle } from '@/layout/AppLayout';
import { LandingPage } from '@/pages/landing/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { ModuleRegistryPage } from '@/pages/ModuleRegistryPage';
import { RoleDetailPage } from '@/pages/RoleDetailPage';
import { RolesPage } from '@/pages/RolesPage';
import { OrganizationDetailPage } from '@/pages/OrganizationDetailPage';
import { OrganizationsPage } from '@/pages/OrganizationsPage';
import { UsersPage } from '@/pages/PlatformPages';
import { TariffPlansPage } from '@/pages/TariffPlansPage';
import { ForbiddenPage, NotFoundPage } from '@/pages/StatusPages';
import { RequireOption, RequireOrganizationAdmin } from '@/features/tenant/access';
import { SuperadminProfilePage } from '@/features/profile/ProfileCard';
import { DepartmentsPage } from '@/pages/tenant/DepartmentsPage';
import { GroupsPage } from '@/pages/tenant/GroupsPage';
import { TenantRolesPage } from '@/pages/tenant/TenantRolesPage';
import { TrainersPage } from '@/pages/tenant/TrainersPage';
import { SuperadminDirectoriesPage, TenantDirectoriesPage } from '@/features/directories/DirectoriesPage';
import { DashboardPage } from '@/pages/tenant/DashboardPage';
import { FeatureUnavailablePage, ModulePage, ProfilePage } from '@/pages/tenant/MiscPages';
import { ModulesPage, OrganizationInfoPage, SubscriptionPage, UsagePage } from '@/pages/tenant/OrganizationPages';
import { SubscriptionBlockedPage } from '@/pages/tenant/SubscriptionBlockedPage';
import { TenantLayout } from '@/pages/tenant/TenantLayout';
import { AdminCabinet, RoleCabinet } from '@/pages/tenant/Cabinets';
import { CourseBuilderPage, ProgramViewAsPage } from '@/pages/tenant/CourseBuilderPage';
import { RegisterPage } from '@/pages/RegisterPage';

function OrganizationCrumb({ tenantId }: { tenantId: string }) {
  const { data } = useQuery({
    queryKey: queryKeys.organization(tenantId),
    queryFn: () => api.organizations.get(tenantId),
    retry: false,
  });
  return <>{data?.name ?? 'Карточка организации'}</>;
}

function RoleCrumb({ roleId }: { roleId: string }) {
  const { data } = useQuery({ queryKey: queryKeys.globalRoles, queryFn: api.roles.list, retry: false });
  return <>{data?.find((r) => r.id === roleId)?.name ?? 'Роль'}</>;
}

const crumb = (title: string) => ({ crumb: () => title }) satisfies CrumbHandle;

/** Страницы кабинета — одинаковы для интерфейсов всех ролей; доступ определяют права роли и конфигурация организации. */
function cabinetRoutes(): RouteObject[] {
  return [
    { path: 'subscription-blocked', element: <SubscriptionBlockedPage /> },
    // Просмотр программы глазами тренера или слушателя — отдельная страница без меню кабинета
    { path: 'm/COURSES/:courseId/view/:role', element: <ProgramViewAsPage /> },
    {
      element: <TenantLayout />,
      children: [
        { index: true, element: <DashboardPage /> },
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
            { path: 'subscription', element: <SubscriptionPage />, handle: crumb('Тарифные планы и оплата') },
            { path: 'modules', element: <ModulesPage />, handle: crumb('Модули') },
            { path: 'usage', element: <UsagePage />, handle: crumb('Лимиты и использование') },
          ],
        },
        { path: 'profile', element: <ProfilePage /> },
        { path: 'directories', element: <TenantDirectoriesPage /> },
        {
          path: 'trainers',
          element: (
            <RequireOption option="lms_trainers.list_view">
              <TrainersPage />
            </RequireOption>
          ),
        },
        {
          path: 'departments',
          element: (
            <RequireOption option="lms_departments.view">
              <DepartmentsPage />
            </RequireOption>
          ),
        },
        {
          path: 'roles',
          element: (
            <RequireOption option="lms_roles.view">
              <TenantRolesPage />
            </RequireOption>
          ),
        },
        {
          path: 'groups',
          element: (
            <RequireOption option="lms_groups.view">
              <GroupsPage />
            </RequireOption>
          ),
        },
        { path: 'feature-unavailable', element: <FeatureUnavailablePage /> },
        { path: 'm/:moduleCode', element: <ModulePage /> },
        { path: 'm/COURSES/:courseId', element: <CourseBuilderPage />, handle: crumb('Курс') },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ];
}

export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/app', element: <HomeRedirect /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
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
      { path: 'profile', element: <SuperadminProfilePage />, handle: crumb('Профиль') },
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
      { path: 'tariffs', element: <TariffPlansPage />, handle: crumb('Тарифные планы') },
      { path: 'modules', element: <ModuleRegistryPage />, handle: crumb('Модули') },
      { path: 'directories', element: <SuperadminDirectoriesPage />, handle: crumb('Справочники') },
      {
        path: 'roles',
        handle: crumb('Роли и доступы'),
        children: [
          { index: true, element: <RolesPage /> },
          { path: ':roleId', element: <RoleDetailPage />, handle: { crumb: (p) => <RoleCrumb roleId={p.roleId ?? ''} /> } satisfies CrumbHandle },
        ],
      },
      { path: 'users', element: <UsersPage />, handle: crumb('Пользователи') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/:clientSlug/admin',
    element: (
      <RequireAuth role="ORGANIZATION_ADMIN">
        <AdminCabinet />
      </RequireAuth>
    ),
    children: cabinetRoutes(),
  },
  {
    path: '/trainer',
    element: (
      <RequireAuth role="TRAINER">
        <RoleCabinet base="/trainer" />
      </RequireAuth>
    ),
    children: cabinetRoutes(),
  },
  {
    path: '/workspace',
    element: (
      <RequireAuth role="CUSTOM">
        <RoleCabinet base="/workspace" />
      </RequireAuth>
    ),
    children: cabinetRoutes(),
  },
  {
    path: '/learn',
    element: (
      <RequireAuth role="LEARNER">
        <RoleCabinet base="/learn" />
      </RequireAuth>
    ),
    children: cabinetRoutes(),
  },
  { path: '*', element: <NotFoundPage /> },
];
