import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Spin, Typography } from 'antd';
import { ArrowRight, Building2, Gauge, Radio, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { tokens } from '@/app/theme';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { Role } from '@/api/types';
import { homeFor } from '@/auth/auth';

interface RoleOption {
  role: Role;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const ROLES: RoleOption[] = [
  {
    role: 'SUPERADMIN',
    label: 'Войти как суперадминистратор',
    title: 'Суперадминистратор',
    description: 'Организации, тарифы, подписки и модули Sanastra',
    icon: ShieldCheck,
  },
  {
    role: 'ORGANIZATION_ADMIN',
    label: 'Войти как администратор организации (academy)',
    title: 'Администратор организации',
    description: 'Кабинет Academy: подписка, модули и лимиты',
    icon: Building2,
  },
  {
    role: 'TENANT_USER',
    label: 'Войти как пользователь организации (academy)',
    title: 'Пользователь организации',
    description: 'Личный кабинет Academy с доступными разделами',
    icon: UserRound,
  },
];

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Building2, title: 'Мультиарендность', text: 'Тарифы, подписки и индивидуальные настройки организаций' },
  { icon: Radio, title: 'Обновления в реальном времени', text: 'Изменения применяются в открытых кабинетах за 1–3 секунды' },
  { icon: Gauge, title: 'Контроль лимитов', text: 'Использование ресурсов и предупреждения о приближении к лимиту' },
];

/** Демо-вход: в реальной системе заменяется SSO/формой логина. */
export function LoginPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useMutation({
    mutationFn: (role: Role) => api.auth.login(role),
    onSuccess: (user) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, user);
      const redirect = params.get('redirect');
      navigate(redirect && redirect.startsWith('/') ? redirect : homeFor(user), { replace: true });
    },
  });

  return (
    <div className="flex min-h-screen bg-page">
      {/* Брендовая панель — только на широких экранах */}
      <aside
        className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{
          background: `radial-gradient(120% 80% at 0% 0%, ${tokens.colorPrimary} 0%, ${tokens.colorSider} 62%)`,
        }}
      >
        <Link
          to="/"
          aria-label="Sanastra — на главную"
          className="focus-ring flex items-center gap-3 self-start rounded-lg text-white! no-underline hover:opacity-90"
        >
          <img src="/brand/sanastra-icon-64.png" width={40} height={40} alt="" className="rounded-lg" />
          <span className="text-lg font-semibold">Sanastra</span>
        </Link>

        <div className="flex flex-col gap-8">
          <div>
            <h1 className="m-0 text-4xl leading-tight font-semibold">
              Управление обучением
              <br />
              для организаций любого масштаба
            </h1>
            <p className="mt-4 mb-0 text-base opacity-80">
              Единое пространство для администраторов Sanastra, организаций и их пользователей.
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={20} aria-hidden />
                </span>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm opacity-75">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sm opacity-60">© {new Date().getFullYear()} Sanastra · Саналы білім, тұрақты даму</div>
      </aside>

      {/* Форма входа */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[440px]">
          <Link
            to="/"
            aria-label="Sanastra — на главную"
            className="focus-ring mb-8 inline-flex items-center gap-3 rounded-lg text-text! no-underline hover:opacity-90 lg:hidden"
          >
            <img src="/brand/sanastra-icon-64.png" width={40} height={40} alt="" className="rounded-lg" />
            <span className="text-lg font-semibold">Sanastra</span>
          </Link>

          <Typography.Title level={2} style={{ margin: 0 }}>
            Добро пожаловать
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 24 }}>
            Выберите учётную запись для входа.
          </Typography.Paragraph>

          {login.isError && <Alert type="error" title={login.error.message} style={{ marginBottom: 16 }} showIcon />}

          <div className="flex flex-col gap-3">
            {ROLES.map(({ role, label, title, description, icon: Icon }) => {
              const loading = login.isPending && login.variables === role;
              return (
                <button
                  key={role}
                  type="button"
                  aria-label={label}
                  disabled={login.isPending}
                  onClick={() => login.mutate(role)}
                  className="focus-ring group flex w-full cursor-pointer items-center gap-4 rounded-lg border border-border bg-surface p-4 text-left transition-all hover:-translate-y-px hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-subtle text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon size={20} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-text">{title}</span>
                    <span className="block text-sm text-muted">{description}</span>
                  </span>
                  {loading ? (
                    <Spin size="small" />
                  ) : (
                    <ArrowRight
                      size={18}
                      aria-hidden
                      className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <Alert
            style={{ marginTop: 24 }}
            type="info"
            showIcon
            title="Демонстрационный режим"
            description="Данные обслуживает мок-сервер (MSW). Откройте панель суперадминистратора и кабинет организации в разных вкладках, чтобы увидеть обновления в реальном времени."
          />
        </div>
      </main>
    </div>
  );
}
