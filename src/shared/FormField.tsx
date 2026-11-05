import type { ReactNode } from 'react';

/** Поле формы: подпись, контрол, ошибка (role=alert) или подсказка. */
export function Field({ label, htmlFor, error, hint, required, children }: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-error">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" id={`${htmlFor}-error`} className="m-0 mt-1 text-xs text-error">
          {error}
        </p>
      ) : (
        hint && <div className="mt-1 text-xs text-muted">{hint}</div>
      )}
    </div>
  );
}
