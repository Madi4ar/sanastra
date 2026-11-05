import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { ArrowRight, Building2, Gauge, LogIn, Radio, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { tokens } from '@/app/theme';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CurrentUser } from '@/api/types';
import { homeFor } from '@/auth/auth';
import { MESSAGES } from '@/features/auth/validation';

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Building2, title: 'Мультиарендность', text: 'Тарифы, подписки и индивидуальные настройки организаций' },
  { icon: Radio, title: 'Обновления в реальном времени', text: 'Изменения применяются в открытых кабинетах за 1–3 секунды' },
  { icon: Gauge, title: 'Контроль лимитов', text: 'Использование ресурсов и предупреждения о приближении к лимиту' },
];

/** Демо-учётные записи мок-сервера (пароль у всех одинаковый). */
const DEMO_ACCOUNTS = [
  { role: 'Суперадминистратор', iin: '850315300128' },
  { role: 'Администратор организации (Academy)', iin: '920705400239' },
  { role: 'Тренер (Academy)', iin: '880425400455' },
  { role: 'Слушатель (Academy)', iin: '951122300340' },
];

/** Брендовая панель и колонка формы — общие для входа и регистрации. */
export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
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

      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className={`w-full ${wide ? 'max-w-[560px]' : 'max-w-[440px]'} py-6`}>
          <Link
            to="/"
            aria-label="Sanastra — на главную"
            className="focus-ring mb-8 inline-flex items-center gap-3 rounded-lg text-text! no-underline hover:opacity-90 lg:hidden"
          >
            <img src="/brand/sanastra-icon-64.png" width={40} height={40} alt="" className="rounded-lg" />
            <span className="text-lg font-semibold">Sanastra</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}

const IIN_FORMAT = /^\d{12}$/;

/** Двухэтапный вход по ИИН: шаг 1 — поиск ИИН, шаг 2 — пароль. */
export function LoginPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [iin, setIin] = useState('');
  const [iinError, setIinError] = useState<string>();
  const [password, setPassword] = useState('');
  /** ИИН найден — показываем поле пароля */
  const [found, setFound] = useState(false);

  const check = useMutation({
    mutationFn: (value: string) => api.auth.checkIin(value),
    onSuccess: () => setFound(true),
  });
  const login = useMutation({
    mutationFn: () => api.auth.login(iin, password),
    onSuccess: (user: CurrentUser) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, user);
      const redirect = params.get('redirect');
      navigate(redirect && redirect.startsWith('/') ? redirect : homeFor(user), { replace: true });
    },
  });

  const onIinChange = (value: string) => {
    setIin(value.replace(/\D/g, '').slice(0, 12));
    setIinError(undefined);
    // Изменение ИИН возвращает на шаг 1
    setFound(false);
    setPassword('');
    check.reset();
    login.reset();
  };

  const submitIin = () => {
    if (!IIN_FORMAT.test(iin)) {
      setIinError(iin ? 'ИИН должен состоять из 12 цифр' : MESSAGES.iinRequired);
      return;
    }
    check.mutate(iin);
  };

  const notFound = isApiError(check.error) && check.error.code === 'USER_NOT_FOUND';
  const checkError = check.isError && !notFound ? check.error : null;

  return (
    <AuthLayout>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Вход
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 24 }}>
        {found ? 'Введите пароль.' : 'Введите ИИН, чтобы продолжить.'}
      </Typography.Paragraph>

      <Form layout="vertical" requiredMark={false} onFinish={found ? () => login.mutate() : submitIin}>
        <Form.Item label="ИИН" htmlFor="login-iin" validateStatus={iinError ? 'error' : undefined} help={iinError}>
          <Input
            id="login-iin"
            size="large"
            inputMode="numeric"
            autoComplete="username"
            placeholder="12 цифр"
            value={iin}
            onChange={(e) => onIinChange(e.target.value)}
            autoFocus
          />
        </Form.Item>

        {notFound && (
          <Alert
            className="mb-6"
            type="error"
            showIcon
            title={check.error?.message}
            action={
              <Button size="small" onClick={() => navigate('/register')}>
                Зарегистрироваться
              </Button>
            }
          />
        )}
        {checkError && <Alert className="mb-6" type="error" showIcon title={checkError.message} />}

        {found && (
          <Form.Item label="Пароль" htmlFor="login-password">
            <Input.Password
              id="login-password"
              size="large"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (login.isError) login.reset();
              }}
              autoFocus
            />
          </Form.Item>
        )}
        {login.isError && <Alert className="mb-6" type="error" showIcon title={login.error.message} />}

        {found ? (
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            block
            icon={<LogIn size={16} />}
            loading={login.isPending}
            disabled={!password}
          >
            Войти
          </Button>
        ) : (
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            block
            icon={<ArrowRight size={16} />}
            iconPlacement="end"
            loading={check.isPending}
          >
            Далее
          </Button>
        )}
      </Form>

      <p className="mt-6 mb-0 text-center text-sm text-muted">
        Нет учётной записи?{' '}
        <Link to="/register" className="font-medium text-primary">
          Зарегистрироваться
        </Link>
      </p>

      <Alert
        style={{ marginTop: 24 }}
        type="info"
        showIcon
        title="Демонстрационный режим"
        description={
          <div className="text-sm">
            <p className="m-0 mb-2">Данные обслуживает мок-сервер. Пароль всех учётных записей: <b>Sanastra1</b></p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.iin} className="flex justify-between gap-3">
                  <span>{a.role}</span>
                  <span className="mono">{a.iin}</span>
                </li>
              ))}
            </ul>
          </div>
        }
      />
    </AuthLayout>
  );
}
