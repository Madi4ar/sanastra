import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import { useEffect, type ReactNode } from 'react';
import { applyCssTokens, theme } from './theme';
import { wireQueryClient } from './queryClient';

dayjs.locale('ru');
if (typeof document !== 'undefined') applyCssTokens();

export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  useEffect(() => wireQueryClient(queryClient), [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      {/* wave-анимация в jsdom вызывает очень медленный getComputedStyle — отключаем только в тестах */}
      <ConfigProvider locale={ruRU} theme={theme} wave={{ disabled: import.meta.env.MODE === 'test' }}>
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
