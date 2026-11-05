import { Button, Result } from 'antd';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useCurrentUser, useLogout } from '@/auth/auth';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const logout = useLogout();
  const { data: user } = useCurrentUser();
  return (
    <Result
      status="403"
      title="403"
      subTitle="Недостаточно прав для просмотра этой страницы."
      extra={
        <div className="flex justify-center gap-2">
          <Button type="primary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/', { replace: true })}>
            На главную
          </Button>
          {user && (
            <Button icon={<LogOut size={16} />} onClick={() => logout.mutate()}>
              Войти под другой учётной записью
            </Button>
          )}
        </div>
      }
    />
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="Страница не найдена."
      extra={
        <Button type="primary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/', { replace: true })}>
          На главную
        </Button>
      }
    />
  );
}
