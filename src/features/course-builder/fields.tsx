import { Input, InputNumber, Select, Switch } from 'antd';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { Field } from '@/shared/FormField';

/** Язык заполнения полей: у каждого текстового поля есть версия на казахском и на русском */
export type Lang = 'ru' | 'kz';
export const LANG_LABEL: Record<Lang, string> = { ru: 'на русском', kz: 'на казахском' };

export type Errors = Record<string, string>;

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  multiline,
  rows = 4,
  maxLength,
  placeholder,
  required,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required}>
      {multiline ? (
        <Input.TextArea
          id={id}
          rows={rows}
          value={value ?? ''}
          maxLength={maxLength}
          showCount={Boolean(maxLength)}
          placeholder={placeholder}
          status={error ? 'error' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value ?? ''}
          maxLength={maxLength}
          placeholder={placeholder}
          status={error ? 'error' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

/** Поле с версиями на двух языках: показывается версия выбранного языка */
export function LangText<K extends string>({
  base,
  label,
  lang,
  values,
  onChange,
  errors,
  ...rest
}: {
  base: K;
  label: string;
  lang: Lang;
  values: Record<string, unknown>;
  onChange: (key: string, v: string) => void;
  errors: Errors;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  hint?: ReactNode;
  placeholder?: string;
}) {
  const key = `${base}_${lang}`;
  return (
    <TextField
      label={`${label} ${LANG_LABEL[lang]}`}
      value={(values[key] as string | null) ?? ''}
      onChange={(v) => onChange(key, v)}
      error={errors[`settings.${key}`]}
      {...rest}
    />
  );
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  hint,
  min,
  max,
  nullable,
  placeholder,
  addonAfter,
  step,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  error?: string;
  hint?: ReactNode;
  min?: number;
  max?: number;
  nullable?: boolean;
  placeholder?: string;
  addonAfter?: string;
  step?: number;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <InputNumber
        id={id}
        className="w-full"
        style={{ width: '100%' }}
        value={value}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        suffix={addonAfter}
        status={error ? 'error' : undefined}
        onChange={(v) => onChange(v === null || v === undefined ? (nullable ? null : (min ?? 0)) : Number(v))}
      />
    </Field>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  error?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <Select<T>
        id={id}
        aria-label={label}
        className="w-full"
        style={{ width: '100%' }}
        value={value}
        onChange={onChange}
        options={options}
      />
    </Field>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <Switch size="small" className="mt-0.5" checked={checked} onChange={onChange} aria-label={label} />
      <span>
        <span className="text-sm">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export const Grid2 = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>;

export const toOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
