import { render } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/AppProviders';
import { createQueryClient } from '@/app/queryClient';
import { routes } from '@/app/routes';
import { load, save, setSession } from '@/mocks/db';
import { DEMO_USERS } from '@/mocks/users';

export const ACADEMY_ID = '7c9e6679-7425-40de-944b-000000000001';

export function loginAs(role: keyof typeof DEMO_USERS | null) {
  setSession(role ? DEMO_USERS[role] : null);
}

/** Изменить запись организации в мок-БД (имитация внешнего изменения). */
export function mutateOrg(tenantId: string, patch: Partial<ReturnType<typeof load>['organizations'][number]>) {
  const db = load();
  const org = db.organizations.find((o) => o.tenantId === tenantId)!;
  Object.assign(org, patch);
  save(db);
}

export function renderApp(path: string) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false, refetchInterval: false },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // Проверка pointer-events через getComputedStyle в jsdom очень медленная со стилями antd
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...utils, router, queryClient, user };
}
