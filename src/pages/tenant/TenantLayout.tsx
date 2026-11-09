import {
  AutoComplete,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  ConfigProvider,
  Drawer,
  Dropdown,
  Grid,
  Input,
  Menu,
  Popover,
  Result,
  Skeleton,
  Spin,
  Tooltip,
  type MenuProps,
  type ThemeConfig,
  Tag,
} from 'antd';
import {
  Bell,
  BookMarked,
  Building2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  Search,
  UserRound,
  Lock,
  Network,
  Presentation,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router';
import { tokens } from '@/app/theme';
import { isApiError } from '@/api/client';
import { useLogout } from '@/auth/auth';
import { roleLabel, useRoleSwitchItems } from '@/features/auth/roles';
import { useTenantContext } from '@/features/tenant/access';
import { useTenantAccess } from '@/features/tenant/queries';
import type { CrumbHandle } from '@/layout/AppLayout';
import { HIDDEN_PAGES } from '@/features/tenant/access';
import { ADVANCED_CONTENT_MODULE } from '@/shared/access';
import { ADVANCED_DIRECTORIES_MODULE } from '@/shared/directories';
import { demoBadgeText, UpgradePromoModal, useModuleCatalog } from '@/features/tenant-admin/UpgradePromo';
import type { CatalogModule } from '@/api/types';
import { formatDate, formatDateTime } from '@/shared/format';
import { ModuleIcon } from '@/shared/ModuleIcon';
import { noticeStore, useNotices } from '@/shared/notices';
import { ErrorState } from '@/shared/PageState';

/** Навигация в визуальном языке NIS Academy: мягкая подложка активного пункта, приглушённые неактивные. */
const navTheme: ThemeConfig = {
  components: {
    Menu: {
      itemBg: 'transparent',
      itemColor: tokens.colorTextSecondary,
      itemHoverColor: tokens.colorText,
      itemHoverBg: tokens.colorBgSubtle,
      itemSelectedBg: tokens.colorPrimarySoft,
      itemSelectedColor: tokens.colorPrimary,
      itemActiveBg: tokens.colorPrimarySoft,
      itemBorderRadius: 8,
      itemHeight: 38,
      itemMarginInline: 0,
      itemMarginBlock: 2,
      itemPaddingInline: 10,
      iconMarginInlineEnd: 10,
      groupTitleColor: tokens.colorTextSecondary,
      groupTitleFontSize: 12,
      activeBarBorderWidth: 0,
      fontSize: 14,
    },
  },
};

/** Разделы скрыты из меню и поиска; доступ к ним настраивается в матрице доступов */
const HIDDEN_FROM_MENU = ['REPORTS', 'CHAT', 'CERTIFICATES', ADVANCED_DIRECTORIES_MODULE, ADVANCED_CONTENT_MODULE, ...HIDDEN_PAGES];

/** Названия разделов в кабинете администратора */
const ADMIN_MODULE_LABEL: Record<string, string> = { COURSES: 'Учебные программы', REPORTS: 'Конструктор отчётов' };

interface NavItem {
  key: string;
  label: string;
  icon: ReactNode;
  to: string;
  /** Активен только при точном совпадении пути */
  exact?: boolean;
  /** Закрытый модуль: клик открывает промо-окно с предложением апгрейда */
  demo?: CatalogModule;
}

function useNavigation(): { main: NavItem[]; organization: NavItem[]; ready: boolean } {
  const { base, clientSlug, availableModules, isAdmin, isLoading, user } = useTenantContext();
  const catalog = useModuleCatalog(clientSlug, isAdmin);
  const access = user?.access ?? [];
  const moduleItem = (m: { code: string; name: string; icon?: string }): NavItem => ({
    key: `m/${m.code}`,
    label: isAdmin ? (ADMIN_MODULE_LABEL[m.code] ?? m.name) : m.name,
    icon: <ModuleIcon name={m.icon} />,
    to: `${base}/m/${m.code}`,
  });
  const available = (code: string) => availableModules.filter((m) => m.code === code).map(moduleItem);
  const section = (option: string, key: string, label: string, icon: ReactNode): NavItem[] =>
    access.includes(option) ? [{ key, label, icon, to: `${base}/${key}` }] : [];
  const SECTION_MODULES = ['USERS', 'COURSES'];
  const inMenu = (m: { code: string }) => !HIDDEN_FROM_MENU.includes(m.code);
  const main: NavItem[] = [
    { key: 'profile', label: 'Профиль', icon: <UserRound size={16} />, to: `${base}/profile` },
    { key: 'dashboard', label: 'Главная', icon: <LayoutDashboard size={16} />, to: base, exact: true },
    ...(isAdmin
      ? [
          {
            key: 'organization/subscription',
            label: 'Тарифные планы и оплата',
            icon: <CreditCard size={16} />,
            to: `${base}/organization/subscription`,
          },
        ]
      : []),
    ...available('USERS'),
    // «Справочники» показываются, если в матрице роли открыт хотя бы один из них
    ...(access.some((k) => /^lms_dir_[a-z_]+\.view$/.test(k))
      ? [{ key: 'directories', label: 'Справочники', icon: <BookMarked size={16} />, to: `${base}/directories` }]
      : []),
    ...section('lms_trainers.list_view', 'trainers', 'Тренерский состав', <Presentation size={16} />),
    ...section('lms_departments.view', 'departments', 'Отделы', <Network size={16} />),
    ...section('lms_roles.view', 'roles', 'Роли и доступы', <ShieldCheck size={16} />),
    ...available('COURSES'),
    ...section('lms_groups.view', 'groups', 'Группы', <UsersRound size={16} />),
    ...availableModules.filter((m) => inMenu(m) && !SECTION_MODULES.includes(m.code)).map(moduleItem),
    // Администратор видит все модули платформы; закрытые — в демо-режиме
    ...(isAdmin ? (catalog.data ?? []).filter((m) => !m.enabled && inMenu(m)).map((m) => ({ ...moduleItem(m), demo: m })) : []),
  ];
  const organization: NavItem[] = isAdmin
    ? [
        { key: 'organization', label: 'Общая информация', icon: <Building2 size={16} />, to: `${base}/organization` },
        { key: 'organization/modules', label: 'Модули', icon: <LayoutGrid size={16} />, to: `${base}/organization/modules` },
        { key: 'organization/usage', label: 'Лимиты и использование', icon: <Gauge size={16} />, to: `${base}/organization/usage` },
      ]
    : [];
  return { main, organization, ready: !isLoading };
}

function NavMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { main, organization, ready } = useNavigation();
  const [promo, setPromo] = useState<CatalogModule | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  // До получения access показываем skeleton навигации — запрещённые пункты не мелькают
  if (!ready) {
    return (
      <div className="px-3 py-2" data-testid="nav-skeleton">
        <Skeleton active title={false} paragraph={{ rows: 6, width: '100%' }} />
      </div>
    );
  }
  const all = [...main, ...organization];
  const selected = all
    .filter((i) => location.pathname === i.to || (!i.exact && location.pathname.startsWith(`${i.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0]?.key;
  const toItem = (i: NavItem) => ({
    key: i.key,
    icon: i.icon,
    label: i.demo ? (
      <Tooltip title={demoBadgeText(i.demo)} placement="right">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{i.label}</span>
          <Tag color="gold" className="m-0 px-1 text-xs leading-4" icon={<Lock size={10} className="mr-0.5 inline" aria-hidden />}>
            Демо
          </Tag>
        </span>
      </Tooltip>
    ) : (
      i.label
    ),
    onClick: () => {
      if (i.demo) {
        setPromo(i.demo);
        return;
      }
      navigate(i.to);
      onNavigate?.();
    },
  });
  const items: MenuProps['items'] = [
    ...main.map(toItem),
    ...(organization.length
      ? [
          {
            type: 'group' as const,
            key: 'org',
            label: <span className="font-semibold tracking-wide uppercase">Организация</span>,
            children: organization.map(toItem),
          },
        ]
      : []),
  ];
  return (
    <ConfigProvider theme={navTheme}>
      <Menu mode="inline" inlineIndent={12} selectedKeys={selected ? [selected] : []} items={items} style={{ borderInlineEnd: 0 }} />
      {promo && <UpgradePromoModal module={promo} onClose={() => setPromo(null)} />}
    </ConfigProvider>
  );
}

/** Логотип кабинета: градиентная плашка (как в NIS Academy) + название организации. */
function Brand({ name }: { name?: string }) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-5">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
        style={{ background: `linear-gradient(135deg, ${tokens.colorPrimary}, ${tokens.colorSecondary})` }}
      >
        <GraduationCap size={20} aria-hidden />
      </span>
      {name ? (
        <span className="truncate text-lg font-bold tracking-tight text-text" title={name}>
          {name}
        </span>
      ) : (
        <Skeleton.Input active size="small" />
      )}
    </div>
  );
}

/** Содержимое боковой панели: подпись роли, меню, сводка подписки для администратора. */
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, access, isAdmin, base } = useTenantContext();
  return (
    <>
      <div className="flex-1 overflow-y-auto px-2 pt-4">
        {user && (
          <p className="m-0 mb-2 px-3 text-xs font-semibold tracking-wide text-muted uppercase">
            {user.role === 'LEARNER' ? 'Личный кабинет' : roleLabel(user)}
          </p>
        )}
        <NavMenu onNavigate={onNavigate} />
      </div>
      {isAdmin && access && (
        <div className="border-t border-border p-3">
          <Link
            to={`${base}/organization/subscription`}
            onClick={onNavigate}
            className="focus-ring flex items-center gap-3 rounded-md bg-primary-soft p-3 text-primary no-underline hover:opacity-90"
          >
            <CreditCard size={18} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">Тариф «{access.tariff.name}»</span>
              <span className="block text-xs opacity-80">до {formatDate(access.subscriptionEndDate)}</span>
            </span>
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      )}
    </>
  );
}

/** Поиск по разделам — только среди доступных пользователю пунктов. */
function SectionSearch() {
  const { main, organization, ready } = useNavigation();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const options = [...main, ...organization]
    .filter((i) => !value || i.label.toLowerCase().includes(value.toLowerCase()))
    .map((i) => ({ value: i.to, label: i.label }));
  return (
    <AutoComplete
      value={value}
      options={options}
      disabled={!ready}
      onSearch={setValue}
      onSelect={(to: string) => {
        setValue('');
        navigate(to);
      }}
      style={{ width: 260 }}
    >
      <Input
        aria-label="Поиск по разделам"
        placeholder="Поиск по разделам"
        prefix={<Search size={16} aria-hidden className="text-muted" />}
      />
    </AutoComplete>
  );
}

function Notifications() {
  const notices = useNotices();
  const unread = notices.filter((n) => !n.read).length;
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      onOpenChange={(open) => open && noticeStore.markAllRead()}
      title={<span className="font-semibold">Уведомления</span>}
      content={
        <div style={{ width: 300 }} data-testid="notices">
          {notices.length === 0 ? (
            <p className="m-0 py-4 text-center text-sm text-muted">Уведомлений пока нет</p>
          ) : (
            <ul className="m-0 flex max-h-96 list-none flex-col gap-1 overflow-y-auto p-0">
              {notices.map((n) => (
                <li key={n.id} className="flex items-start gap-2 rounded-md p-2 hover:bg-subtle">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-border' : 'bg-primary'}`}
                    aria-label={n.read ? undefined : 'не прочитано'}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{n.text}</span>
                    <span className="block text-xs text-muted">{formatDateTime(n.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    >
      <Tooltip title="Уведомления">
        <Badge count={unread} size="small" offset={[-4, 4]}>
          <Button aria-label={`Уведомления${unread ? `: ${unread} новых` : ''}`} icon={<Bell size={16} />} />
        </Badge>
      </Tooltip>
    </Popover>
  );
}

function ProfileMenu() {
  const { user, base } = useTenantContext();
  const navigate = useNavigate();
  const logout = useLogout();
  const roleItems = useRoleSwitchItems() ?? [];
  if (!user) return null;
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'profile', icon: <UserRound size={16} />, label: 'Профиль', onClick: () => navigate(`${base}/profile`) },
          ...(roleItems.length ? [{ type: 'divider' as const }, ...roleItems] : []),
          { type: 'divider' },
          { key: 'logout', icon: <LogOut size={16} />, label: 'Выйти', onClick: () => logout.mutate() },
        ],
      }}
    >
      <Button aria-label="Меню профиля" className="flex items-center gap-2" style={{ height: 44, paddingInline: 8 }}>
        <Avatar size={28} src={user.avatar} icon={<UserRound size={14} />} style={{ background: tokens.colorPrimary }} />
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block max-w-36 truncate text-sm leading-tight font-medium">{user.fullName}</span>
          <span className="block text-xs leading-tight text-muted">{roleLabel(user)}</span>
        </span>
        <ChevronDown size={16} aria-hidden className="text-muted" />
      </Button>
    </Dropdown>
  );
}

function Breadcrumbs() {
  const matches = useMatches();
  const crumbs = matches.filter((m) => (m.handle as CrumbHandle | undefined)?.crumb);
  if (crumbs.length < 2) return null; // только на вложенных страницах
  return (
    <ConfigProvider theme={{ components: { Breadcrumb: { fontSize: 12 } } }}>
      <Breadcrumb
        className="mb-2"
        separator={<ChevronRight size={12} aria-hidden className="relative top-0.5" />}
        items={crumbs.map((m, i) => {
          const node = (m.handle as CrumbHandle).crumb(m.params);
          return { key: m.id, title: i === crumbs.length - 1 ? node : <Link to={m.pathname}>{node}</Link> };
        })}
      />
    </ConfigProvider>
  );
}

/** Кабинет организации и личный кабинет. Решение о блокировке принимает сервер (subscriptionStatus). */
export function TenantLayout() {
  const { clientSlug, base, access, isLoading } = useTenantContext();
  const accessQuery = useTenantAccess(clientSlug);
  const screens = Grid.useBreakpoint();
  const isDesktop = screens.lg ?? true;
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (accessQuery.isError && !access) {
    if (isApiError(accessQuery.error) && accessQuery.error.code === 'FORBIDDEN') return <Navigate to="/403" replace />;
    if (isApiError(accessQuery.error) && accessQuery.error.code === 'NOT_FOUND')
      return <Result status="404" title="Организация не найдена" />;
    return <ErrorState error={accessQuery.error} onRetry={() => void accessQuery.refetch()} />;
  }
  if (access && access.subscriptionStatus !== 'ACTIVE') {
    return <Navigate to={`${base}/subscription-blocked`} replace />;
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {isDesktop && (
        <aside className="sticky top-0 flex h-screen flex-col border-r border-border bg-surface">
          <Brand name={access?.organizationName} />
          <SidebarContent />
        </aside>
      )}
      {!isDesktop && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          size={280}
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' }, header: { display: 'none' } }}
        >
          <Brand name={access?.organizationName} />
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}
      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border px-4 backdrop-blur sm:px-6"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 90%, transparent)' }}
        >
          {!isDesktop && (
            <>
              <Tooltip title="Меню">
                <Button type="text" aria-label="Открыть меню" icon={<MenuIcon size={18} />} onClick={() => setDrawerOpen(true)} />
              </Tooltip>
              <span className="min-w-0 truncate font-semibold text-text">{access?.organizationName ?? ''}</span>
            </>
          )}
          {isDesktop && screens.md && <SectionSearch />}
          <div className="ml-auto flex items-center gap-2">
            {/* Фоновое обновление конфигурации — не блокирует интерфейс */}
            {accessQuery.isFetching && !accessQuery.isPending && (
              <span className="flex items-center gap-1 text-xs text-muted" aria-live="polite" data-testid="config-refreshing">
                <Spin size="small" /> <span className="hidden sm:inline">Обновление…</span>
              </span>
            )}
            {!isDesktop && screens.md && <SectionSearch />}
            <Notifications />
            <ProfileMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
          <Breadcrumbs />
          {isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
