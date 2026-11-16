import { useMutation } from '@tanstack/react-query';
import { Alert, Button, Card, Result, Spin } from 'antd';
import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { api } from '@/api/endpoints';
import { useCurrentUser } from '@/auth/auth';

export function InviteGroupPage() {
  const { hash = '' } = useParams();
  const location = useLocation();
  const current = useCurrentUser();
  const enroll = useMutation({ mutationFn: () => api.showcase.invite(hash) });

  useEffect(() => {
    if (current.data && !enroll.isPending && !enroll.data && !enroll.error) enroll.mutate();
  }, [current.data, enroll]);

  if (current.isPending) return <div className="flex min-h-screen items-center justify-center"><Spin size="large" /></div>;
  if (!current.data) {
    const redirect = encodeURIComponent(location.pathname);
    return (
      <div className="flex min-h-screen items-center justify-center bg-page p-6">
        <Card className="w-full max-w-lg text-center" title="Приглашение в учебную группу">
          <p>Войдите или зарегистрируйтесь — после этого вы будете автоматически зачислены в группу.</p>
          <div className="flex justify-center gap-3">
            <Link to={`/login?redirect=${redirect}`}><Button type="primary">Войти</Button></Link>
            <Link to={`/register?redirect=${redirect}`}><Button>Зарегистрироваться</Button></Link>
          </div>
        </Card>
      </div>
    );
  }
  if (enroll.isPending || !enroll.data && !enroll.error) return <div className="flex min-h-screen items-center justify-center"><Spin size="large" /></div>;
  if (enroll.isError) return <div className="mx-auto max-w-xl p-8"><Alert type="error" showIcon title={enroll.error.message} /></div>;
  return <Result status="success" title="Вы зачислены в группу" subTitle={`${enroll.data.groupName}${enroll.data.courseTitle ? ` · ${enroll.data.courseTitle}` : ''}`} extra={<Link to="/learn"><Button type="primary">Перейти в личный кабинет</Button></Link>} />;
}
