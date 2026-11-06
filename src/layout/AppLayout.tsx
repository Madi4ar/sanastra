import { Avatar, Breadcrumb, Button, Layout, Menu, Tooltip, Typography } from 'antd';
import { Blocks, Building2, LogOut, Package, PanelLeftClose, PanelLeftOpen, UserRound, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useMatches, useNavigate } from 'react-router';
import { tokens } from '@/app/theme';
import { useCurrentUser, useLogout } from '@/auth/auth';
import { ROLE_LABEL, RoleSwitcher } from '@/features/auth/roles';

export interface CrumbHandle {
  crumb: (params: Record<string, string | undefined>) => ReactNode;
}

const COLLAPSE_KEY = 'superadmin-sider-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const { data: user } = useCurrentUser();
  const logout = useLogout();

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const crumbs = matches
    .filter((m) => (m.handle as CrumbHandle | undefined)?.crumb)
    .map((m, i, arr) => {
      const node = (m.handle as CrumbHandle).crumb(m.params);
      const last = i === arr.length - 1;
      return { key: m.id, title: last ? node : <Link to={m.pathname}>{node}</Link> };
    });

  const selected = ['organizations', 'tariffs', 'modules', 'users'].filter((k) => location.pathname.startsWith(`/superadmin/${k}`));

  return (
    <Layout style={{ minHeight: '100vh', minWidth: 1024 }}>
      <Layout.Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={240}
        collapsedWidth={64}
        style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'auto' }}
      >
        <div className="flex h-14 items-center gap-2 px-5 text-white">
          <img src="/brand/sanastra-icon-64.png" width={32} height={32} alt="" className="shrink-0 rounded-lg" />
          {!collapsed && <span className="truncate font-semibold">Sanastra · Админ</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selected}
          items={[
            {
              key: 'organizations',
              icon: <Building2 size={16} />,
              label: 'Организации',
              onClick: () => navigate('/superadmin/organizations'),
            },
            {
              key: 'tariffs',
              icon: <Package size={16} />,
              label: 'Тарифные планы',
              onClick: () => navigate('/superadmin/tariffs'),
            },
            { key: 'modules', icon: <Blocks size={16} />, label: 'Модули', onClick: () => navigate('/superadmin/modules') },
            { key: 'users', icon: <Users size={16} />, label: 'Пользователи', onClick: () => navigate('/superadmin/users') },
          ]}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="flex items-center justify-between" style={{ borderBottom: `1px solid ${tokens.colorBorder}` }}>
          <Tooltip title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}>
            <Button
              type="text"
              aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
              icon={collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              onClick={toggle}
            />
          </Tooltip>
          {user && (
            <div className="flex items-center gap-3" data-testid="current-user">
              <RoleSwitcher />
              <Avatar size={32} icon={<UserRound size={16} />} style={{ background: tokens.colorPrimary }} />
              <div className="flex flex-col leading-tight">
                <Typography.Text strong>{user.fullName}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {ROLE_LABEL[user.role]} · {user.email}
                </Typography.Text>
              </div>
              <Tooltip title="Выйти">
                <Button
                  type="text"
                  aria-label="Выйти"
                  icon={<LogOut size={16} />}
                  loading={logout.isPending}
                  onClick={() => logout.mutate()}
                />
              </Tooltip>
            </div>
          )}
        </Layout.Header>
        <Layout.Content className="px-6 pt-4 pb-0">
          <Breadcrumb items={crumbs} className="mb-4" />
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
