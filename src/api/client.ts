export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'MODULE_DISABLED'
  | 'TENANT_BLOCKED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'LIMIT_REACHED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

interface ApiErrorBody {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Проверьте правильность заполнения полей.',
  UNAUTHORIZED: 'Сессия истекла. Войдите снова.',
  FORBIDDEN: 'Недостаточно прав для выполнения операции.',
  MODULE_DISABLED: 'Модуль недоступен для вашей организации.',
  TENANT_BLOCKED: 'Доступ организации временно приостановлен.',
  SUBSCRIPTION_EXPIRED: 'Срок действия подписки истёк.',
  LIMIT_REACHED: 'Достигнут лимит тарифа. Обратитесь к администратору организации.',
  NOT_FOUND: 'Запрашиваемые данные не найдены.',
  CONFLICT: 'Данные были изменены другим пользователем или системой оплаты.',
  SERVER_ERROR: 'Сервер временно недоступен. Повторите попытку позже.',
  NETWORK_ERROR: 'Нет соединения с сервером. Проверьте подключение и повторите попытку.',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: ApiErrorCode, message?: string, fieldErrors: Record<string, string> = {}) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

function codeFromStatus(status: number, body: ApiErrorBody): ApiErrorCode {
  if (status === 400 || status === 422) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) {
    const known = ['MODULE_DISABLED', 'TENANT_BLOCKED', 'SUBSCRIPTION_EXPIRED', 'LIMIT_REACHED'] as const;
    return known.find((c) => c === body.code) ?? 'FORBIDDEN';
  }
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT'; // в т.ч. CONFIG_VERSION_CHANGED
  return 'SERVER_ERROR';
}

/** Сообщение из backend показывается только для 400 (оно предназначено пользователю). Сырые исключения 5xx скрываются. */
function messageFor(code: ApiErrorCode, body: ApiErrorBody): string {
  if (code === 'VALIDATION_ERROR' && body.message) return body.message;
  return DEFAULT_MESSAGES[code];
}

type Listener = (error: ApiError) => void;
const listeners = new Set<Listener>();

/** Глобальная подписка на ошибки (401 → вход, MODULE_DISABLED → инвалидация прав). */
export function onApiError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    const error = new ApiError(0, 'NETWORK_ERROR');
    listeners.forEach((l) => l(error));
    throw error;
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    /* тело ошибки может отсутствовать */
  }
  const code = codeFromStatus(response.status, body);
  const error = new ApiError(response.status, code, messageFor(code, body), body.fieldErrors ?? {});
  listeners.forEach((l) => l(error));
  throw error;
}

export function toQueryString(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}
