import { Alert, Avatar, Button, Card, Empty, Skeleton } from 'antd';
import { ArrowRight, CalendarDays, CreditCard, LayoutGrid, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { tokens } from '@/app/theme';
import type { TenantAccess, TenantModule } from '@/api/types';
import { useTenantContext } from '@/features/tenant/access';
import { CardGrid, ModuleCard } from '@/features/tenant/ModuleCard';
import { useTenantUsage } from '@/features/tenant/queries';
import { StatCard, StatGrid } from '@/features/tenant/StatCard';
import { UsageBar } from '@/features/tenant/UsageBar';
import { formatDate } from '@/shared/format';
import { Highlight } from '@/shared/Highlight';
import { PageHeader, SectionTitle } from './PageHeader';

export const isExpiringSoon = (a: Pick<TenantAccess, 'daysLeft' | 'expiryWarningDays'>) =>
  a.daysLeft <= a.expiryWarningDays;

export function ExpiringAlert({ daysLeft, endDate }: { daysLeft: number; endDate: string }) {
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="expiring-alert"
      title="Подписка скоро истекает"
      description={`Осталось ${daysLeft} дн. — до ${formatDate(endDate)} включительно. Обратитесь к администратору Sanastra для продления.`}
    />
  );
}

function ModulesSection({ modules, title }: { modules: TenantModule[]; title: string }) {
  return (
    <section aria-labelledby="modules-h">
      <SectionTitle title={<span id="modules-h">{title}</span>} />
      {modules.length ? (
        <CardGrid testId="quick-actions" min={220}>
          {modules.map((m, i) => (
            <ModuleCard key={m.code} module={m} index={i} />
          ))}
        </CardGrid>
      ) : (
        <Card>
          <Empty description="Нет доступных разделов" />
        </Card>
      )}
    </section>
  );
}

/** Обзор администратора организации: KPI подписки, быстрые действия и лимиты. */
function OrganizationDashboard() {
  const { clientSlug, base, user, access, visibleModules } = useTenantContext();
  const navigate = useNavigate();
  const usage = useTenantUsage(clientSlug);
  if (!access || !user) return null;
  const expiring = isExpiringSoon(access);

  return (
    <>
      <div data-testid="dashboard-hero">
        <PageHeader
          title={`Здравствуйте, ${user.fullName.split(' ')[0]}!`}
          subtitle={`Сводка по подписке, модулям и лимитам организации «${access.organizationName}».`}
          extra={
            <Button
              type="primary"
              icon={<ArrowRight size={16} />}
              iconPlacement="end"
              onClick={() => navigate(`${base}/organization/subscription`)}
            >
              Подробнее о подписке
            </Button>
          }
        />
        <StatGrid>
          <StatCard
            label="Подписка"
            value="Активна"
            tone="success"
            icon={<ShieldCheck size={20} />}
            hint={
              <>
                до{' '}
                <Highlight value={access.subscriptionEndDate}>
                  <span data-testid="hero-end-date">{formatDate(access.subscriptionEndDate)}</span>
                </Highlight>
              </>
            }
          />
          <StatCard
            label="Тариф"
            value={<Highlight value={access.tariff.name}>{access.tariff.name}</Highlight>}
            hint="Настраивает администратор Sanastra"
            icon={<CreditCard size={20} />}
          />
          <StatCard
            label="Осталось дней"
            value={<Highlight value={access.daysLeft}>{access.daysLeft}</Highlight>}
            hint="включая дату окончания"
            tone={expiring ? 'warning' : 'info'}
            icon={<CalendarDays size={20} />}
          />
          <StatCard
            label="Доступно разделов"
            value={visibleModules.length}
            hint="по тарифу и правам ролей"
            tone="info"
            icon={<LayoutGrid size={20} />}
          />
        </StatGrid>
      </div>

      {expiring && (
        <div className="mt-6">
          <ExpiringAlert daysLeft={access.daysLeft} endDate={access.subscriptionEndDate} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <ModulesSection modules={visibleModules} title="Быстрые действия" />
        <section aria-labelledby="usage-h">
          <SectionTitle
            title={<span id="usage-h">Использование лимитов</span>}
            extra={
              <Link to={`${base}/organization/usage`} className="text-sm text-primary hover:underline">
                Подробнее
              </Link>
            }
          />
          <Card styles={{ body: { padding: 20 } }}>
            {usage.isPending ? (
              <Skeleton active title={false} paragraph={{ rows: 4 }} />
            ) : usage.isError ? (
              <Alert type="error" showIcon title="Не удалось загрузить использование лимитов" />
            ) : (
              <div className="flex flex-col gap-5">
                {usage.data.items.slice(0, 5).map((i) => (
                  <UsageBar key={i.code} item={i} />
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}

/** Личный кабинет пользователя: крупная приветственная карточка и доступные разделы. */
function UserDashboard() {
  const { base, user, access, visibleModules } = useTenantContext();
  const navigate = useNavigate();
  if (!access || !user) return null;
  const first = visibleModules[0];

  return (
    <>
      <div
        className="relative mb-6 overflow-hidden rounded-lg p-6 text-white sm:p-8"
        style={{ background: `linear-gradient(135deg, ${tokens.colorPrimary} 0%, ${tokens.colorPrimaryHover} 100%)` }}
        data-testid="dashboard-hero"
      >
        <span className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10" aria-hidden />
        <span className="pointer-events-none absolute -right-4 -bottom-16 h-40 w-40 rounded-full bg-white/10" aria-hidden />
        <p className="m-0 text-sm font-medium opacity-85">
          {access.organizationName} · доступ до{' '}
          <Highlight value={access.subscriptionEndDate}>
            <span data-testid="hero-end-date">{formatDate(access.subscriptionEndDate)}</span>
          </Highlight>
        </p>
        <h1 className="m-0 mt-1 text-3xl font-bold tracking-tight">Здравствуйте, {user.fullName.split(' ')[0]}!</h1>
        <p className="m-0 mt-2 max-w-xl opacity-85">
          {visibleModules.length
            ? `Вам доступно разделов: ${visibleModules.length}. Выберите, с чего начать.`
            : 'Пока нет доступных разделов — обратитесь к администратору организации.'}
        </p>
        {first && (
          <Button
            size="large"
            className="mt-6"
            icon={<ArrowRight size={16} />}
            iconPlacement="end"
            onClick={() => navigate(`${base}/m/${first.code}`)}
            style={{ background: tokens.colorBgSurface, color: tokens.colorPrimary, borderColor: 'transparent' }}
          >
            Открыть «{first.name}»
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <ModulesSection modules={visibleModules} title="Мои разделы" />
        <section aria-labelledby="profile-h">
          <SectionTitle title={<span id="profile-h">Профиль</span>} />
          <Card styles={{ body: { padding: 20 } }}>
            <div className="flex items-center gap-3">
              <Avatar size={44} icon={<UserRound size={20} />} style={{ background: tokens.colorPrimary }} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{user.fullName}</div>
                <div className="truncate text-sm text-muted">{user.email}</div>
              </div>
            </div>
            <Link
              to={`${base}/profile`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Открыть профиль <ArrowRight size={14} aria-hidden />
            </Link>
          </Card>
        </section>
      </div>
    </>
  );
}

export function DashboardPage() {
  const { isAdmin } = useTenantContext();
  return isAdmin ? <OrganizationDashboard /> : <UserDashboard />;
}
