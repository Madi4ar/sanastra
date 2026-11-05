import { createContext, useContext } from 'react';

/**
 * Рабочий контекст кабинета: организация и базовый путь интерфейса роли
 * (Слушатель → /learn, Тренер → /trainer, Админ организации → /{client_slug}/admin).
 */
export interface Cabinet {
  clientSlug: string;
  base: string;
}

const CabinetContext = createContext<Cabinet | null>(null);

export const CabinetProvider = CabinetContext.Provider;

export function useCabinet(): Cabinet {
  const cabinet = useContext(CabinetContext);
  if (!cabinet) throw new Error('useCabinet: компонент вне кабинета');
  return cabinet;
}
