import { Button, Result } from 'antd';
import { RefreshCw } from 'lucide-react';
import { isApiError } from '@/api/client';

export function ErrorState({ error, onRetry, title = 'Не удалось загрузить данные' }: {
  error: unknown;
  onRetry: () => void;
  title?: string;
}) {
  const text = isApiError(error) ? error.message : 'Произошла непредвиденная ошибка.';
  return (
    <Result
      status="error"
      title={title}
      subTitle={text}
      extra={
        <Button type="primary" icon={<RefreshCw size={16} />} onClick={onRetry}>
          Повторить
        </Button>
      }
    />
  );
}
