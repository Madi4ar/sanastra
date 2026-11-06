import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';

/** Значения справочника для выпадающего списка: глобальные и собственные записи организации */
export function useDirectoryOptions(clientSlug: string, code: string) {
  return useQuery({
    queryKey: queryKeys.directoryOptions(clientSlug, code),
    queryFn: () => api.tenantDirectories(clientSlug).options(code),
  });
}
