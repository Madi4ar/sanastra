import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Divider, Input, Modal, Select, Skeleton, Switch, Table, Tabs, Tag } from 'antd';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type {
  ProfileFieldBuilderData,
  ProfileFieldDefinition,
  ProfileFieldOption,
  ProfileFieldPayload,
  ProfileFieldScheme,
  ProfileFieldSchemePayload,
} from '@/api/types';
import { useTenantContext } from '@/features/tenant/access';
import { Field } from '@/shared/FormField';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { PageHeader } from './PageHeader';

const blankOption = (): ProfileFieldOption => ({ id: crypto.randomUUID(), labelKz: '', labelRu: '', labelEn: '' });
const LANGS = [
  ['labelKz', 'KZ'],
  ['labelRu', 'RU'],
  ['labelEn', 'EN'],
] as const;

/** Значения справочника выпадающего поля на трёх языках */
export function OptionsEditor({ options, onChange, error }: { options: ProfileFieldOption[]; onChange: (options: ProfileFieldOption[]) => void; error?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Divider style={{ margin: '8px 0' }}>Справочник значений</Divider>
      {options.map((option, index) => (
        <div key={option.id} className="flex gap-2">
          {LANGS.map(([key, lang]) => (
            <Input
              key={key}
              aria-label={`Значение ${index + 1} (${lang})`}
              placeholder={lang}
              value={option[key]}
              onChange={(event) => onChange(options.map((o, j) => (j === index ? { ...o, [key]: event.target.value } : o)))}
            />
          ))}
          <IconButton label={`Удалить значение ${index + 1}`} icon={<Trash2 size={15} />} disabled={options.length === 1} onClick={() => onChange(options.filter((_, j) => j !== index))} />
        </div>
      ))}
      {error && (
        <p role="alert" className="m-0 text-xs text-error">
          {error}
        </p>
      )}
      <div>
        <Button icon={<Plus size={15} aria-hidden />} onClick={() => onChange([...options, blankOption()])}>
          Добавить значение
        </Button>
      </div>
    </div>
  );
}

/** Форма поля: название на трёх языках, тип и справочник значений */
export function FieldForm({
  values,
  onChange,
  errors,
  canDropdown,
  lockType,
}: {
  values: ProfileFieldPayload;
  onChange: (values: ProfileFieldPayload) => void;
  errors: Record<string, string>;
  canDropdown: boolean;
  lockType?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {LANGS.map(([key, lang]) => (
        <Field key={key} label={`Название (${lang})`} htmlFor={`field-${key}`} required error={errors[key]}>
          <Input id={`field-${key}`} value={values[key]} onChange={(event) => onChange({ ...values, [key]: event.target.value })} />
        </Field>
      ))}
      <Field label="Тип поля" htmlFor="field-type" error={errors.type}>
        <Select
          id="field-type"
          className="w-full"
          disabled={lockType}
          value={values.type}
          options={[{ value: 'TEXT', label: 'Текст' }, ...(canDropdown || values.type === 'DROPDOWN' ? [{ value: 'DROPDOWN', label: 'Выпадающий список' }] : [])]}
          onChange={(type) => onChange({ ...values, type, options: type === 'DROPDOWN' && !values.options.length ? [blankOption()] : values.options })}
        />
      </Field>
      {values.type === 'DROPDOWN' && !lockType && <OptionsEditor options={values.options} onChange={(options) => onChange({ ...values, options })} error={errors.options} />}
    </div>
  );
}

const emptyField = (): ProfileFieldPayload => ({ labelKz: '', labelRu: '', labelEn: '', type: 'TEXT', options: [] });
const toPayload = (f: ProfileFieldDefinition): ProfileFieldPayload => ({ labelKz: f.labelKz, labelRu: f.labelRu, labelEn: f.labelEn, type: f.type, options: f.options });

function FieldModal({ field, canDropdown, onClose }: { field: ProfileFieldDefinition | null; canDropdown: boolean; onClose: () => void }) {
  const { clientSlug } = useTenantContext();
  const qc = useQueryClient();
  const [values, setValues] = useState<ProfileFieldPayload>(field ? toPayload(field) : emptyField());
  const save = useMutation({
    mutationFn: () => (field ? api.profileFields(clientSlug).updateField(field.id, values) : api.profileFields(clientSlug).createField(values)),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.profileFields(clientSlug), data);
      onClose();
    },
  });
  const errors = isApiError(save.error) ? save.error.fieldErrors : {};
  return (
    <Modal open title={field ? 'Редактирование поля' : 'Новое пользовательское поле'} okText={field ? 'Сохранить' : 'Создать'} cancelText="Отмена" confirmLoading={save.isPending} onOk={() => save.mutate()} onCancel={onClose} width={680} destroyOnHidden>
      <FieldForm values={values} onChange={(next) => { setValues(next); save.reset(); }} errors={errors} canDropdown={canDropdown} />
      {save.isError && !Object.keys(errors).length && <Alert className="mt-3" type="error" showIcon title={save.error.message} />}
    </Modal>
  );
}

function SchemeModal({ scheme, data, onClose }: { scheme: ProfileFieldScheme | null; data: ProfileFieldBuilderData; onClose: () => void }) {
  const { clientSlug } = useTenantContext();
  const qc = useQueryClient();
  const fields = [...data.globals.filter((f) => f.activeForTenant), ...data.custom.filter((f) => f.active)];
  const [values, setValues] = useState<ProfileFieldSchemePayload>(scheme ? { name: scheme.name, fields: scheme.fields } : { name: '', fields: [] });
  const save = useMutation({
    mutationFn: () => (scheme ? api.profileFields(clientSlug).updateScheme(scheme.id, values) : api.profileFields(clientSlug).createScheme(values)),
    onSuccess: (next) => {
      qc.setQueryData(queryKeys.profileFields(clientSlug), next);
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'group-options') });
      onClose();
    },
  });
  const errors = isApiError(save.error) ? save.error.fieldErrors : {};
  const row = (id: string) => values.fields.find((r) => r.fieldId === id);
  const toggle = (id: string, selected: boolean) =>
    setValues((v) => ({ ...v, fields: selected ? [...v.fields, { fieldId: id, required: false }] : v.fields.filter((r) => r.fieldId !== id) }));
  const setRequired = (id: string, required: boolean) => setValues((v) => ({ ...v, fields: v.fields.map((r) => (r.fieldId === id ? { ...r, required } : r)) }));
  return (
    <Modal open title={scheme ? 'Редактирование схемы' : 'Новая схема полей'} okText={scheme ? 'Сохранить' : 'Создать'} cancelText="Отмена" confirmLoading={save.isPending} onOk={() => save.mutate()} onCancel={onClose} width={680} destroyOnHidden>
      <Field label="Название схемы" htmlFor="scheme-name" required error={errors.name}>
        <Input id="scheme-name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
      </Field>
      <Table
        className="mt-4"
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={fields}
        columns={[
          { title: 'Поле', dataIndex: 'labelRu' },
          { title: 'Включить', width: 100, render: (_, f) => <Checkbox aria-label={`Включить: ${f.labelRu}`} checked={Boolean(row(f.id))} onChange={(event) => toggle(f.id, event.target.checked)} /> },
          { title: 'Обязательное', width: 130, render: (_, f) => <Checkbox aria-label={`Обязательное: ${f.labelRu}`} disabled={!row(f.id)} checked={Boolean(row(f.id)?.required)} onChange={(event) => setRequired(f.id, event.target.checked)} /> },
        ]}
      />
      {errors.fields && (
        <p role="alert" className="m-0 mt-2 text-xs text-error">
          {errors.fields}
        </p>
      )}
      {save.isError && !Object.keys(errors).length && <Alert className="mt-3" type="error" showIcon title={save.error.message} />}
    </Modal>
  );
}

export function ProfileFieldBuilderPage() {
  const { clientSlug, user } = useTenantContext();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const key = queryKeys.profileFields(clientSlug);
  const data = useQuery({ queryKey: key, queryFn: () => api.profileFields(clientSlug).get() });
  const [fieldModal, setFieldModal] = useState<{ field: ProfileFieldDefinition | null } | null>(null);
  const [schemeModal, setSchemeModal] = useState<{ scheme: ProfileFieldScheme | null } | null>(null);
  const can = (option: string) => Boolean(user?.access.includes(`lms_profile_field_builder.${option}`));
  const onSaved = (next: ProfileFieldBuilderData) => qc.setQueryData(key, next);
  const onError = (error: Error) => message.error(error.message);
  const toggle = useMutation({ mutationFn: (v: { id: string; active: boolean }) => api.profileFields(clientSlug).toggleGlobal(v.id, v.active), onSuccess: onSaved, onError });
  const trainerScheme = useMutation({ mutationFn: (id: string | null) => api.profileFields(clientSlug).setTrainerScheme(id), onSuccess: onSaved, onError });

  if (data.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />;
  const d = data.data;

  const confirmRemove = (title: string, run: () => Promise<ProfileFieldBuilderData>) =>
    modal.confirm({
      title,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          onSaved(await run());
          void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'group-options') });
        } catch (error) {
          onError(error as Error);
        }
      },
    });

  const fieldsTab = (
    <>
      <Card title="Глобальные поля">
        <Table
          rowKey="id"
          pagination={false}
          dataSource={d.globals}
          columns={[
            { title: 'Поле', dataIndex: 'labelRu' },
            { title: 'Тип', width: 180, render: (_, f) => <Tag>{f.type === 'DROPDOWN' ? 'Выпадающий список' : 'Текст'}</Tag> },
            {
              title: 'Используется в компании',
              width: 200,
              render: (_, f) => (
                <Switch aria-label={`Использовать поле ${f.labelRu}`} disabled={!can('custom_fields')} checked={f.activeForTenant} loading={toggle.isPending && toggle.variables?.id === f.id} onChange={(active) => toggle.mutate({ id: f.id, active })} />
              ),
            },
          ]}
        />
      </Card>
      <Card
        className="mt-4"
        title="Пользовательские поля"
        extra={can('custom_fields') && <Button type="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setFieldModal({ field: null })}>Создать поле</Button>}
      >
        <Table
          rowKey="id"
          pagination={false}
          dataSource={d.custom}
          locale={{ emptyText: 'Собственных полей пока нет' }}
          columns={[
            { title: 'Название (KZ)', dataIndex: 'labelKz' },
            { title: 'Название (RU)', dataIndex: 'labelRu' },
            { title: 'Название (EN)', dataIndex: 'labelEn' },
            {
              title: 'Тип',
              render: (_, f) => (
                <div>
                  <Tag>{f.type === 'DROPDOWN' ? 'Выпадающий список' : 'Текст'}</Tag>
                  {f.type === 'DROPDOWN' && <div className="mt-1 text-xs text-muted">{f.options.map((o) => o.labelRu).join(', ')}</div>}
                </div>
              ),
            },
            {
              title: '',
              width: 96,
              render: (_, f) =>
                can('custom_fields') && (
                  <div className="flex gap-1">
                    <IconButton type="text" label={`Изменить поле ${f.labelRu}`} icon={<Pencil size={15} />} onClick={() => setFieldModal({ field: f })} />
                    <IconButton type="text" danger label={`Удалить поле ${f.labelRu}`} icon={<Trash2 size={15} />} onClick={() => confirmRemove(`Удалить поле «${f.labelRu}»?`, () => api.profileFields(clientSlug).removeField(f.id))} />
                  </div>
                ),
            },
          ]}
        />
      </Card>
    </>
  );

  const schemesTab = (
    <Card title="Наборы полей" extra={can('schemes') && <Button type="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setSchemeModal({ scheme: null })}>Создать схему</Button>}>
      <label className="mb-5 flex max-w-md flex-col gap-1.5">
        <span className="text-sm font-medium">Схема анкеты тренера</span>
        <Select
          aria-label="Схема анкеты тренера"
          allowClear
          placeholder="Не выбрана"
          disabled={!can('schemes')}
          loading={trainerScheme.isPending}
          value={d.trainerSchemeId ?? undefined}
          options={d.schemes.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(value: string | undefined) => trainerScheme.mutate(value ?? null)}
        />
      </label>
      <Table
        rowKey="id"
        pagination={false}
        dataSource={d.schemes}
        columns={[
          { title: 'Название', render: (_, s) => <>{s.name} {s.isDefault && <Tag>Основная</Tag>}</> },
          { title: 'Поля', render: (_, s) => s.fields.length },
          { title: 'Обязательные', render: (_, s) => s.fields.filter((f) => f.required).length },
          { title: 'Групп', render: (_, s) => s.groupsCount },
          {
            title: '',
            width: 96,
            render: (_, s) =>
              can('schemes') && (
                <div className="flex gap-1">
                  <IconButton type="text" label={`Изменить схему ${s.name}`} icon={<Pencil size={15} />} onClick={() => setSchemeModal({ scheme: s })} />
                  {!s.isDefault && (
                    <IconButton type="text" danger label={`Удалить схему ${s.name}`} icon={<Trash2 size={15} />} onClick={() => confirmRemove(`Удалить схему «${s.name}»?`, () => api.profileFields(clientSlug).removeScheme(s.id))} />
                  )}
                </div>
              ),
          },
        ]}
      />
    </Card>
  );

  return (
    <>
      <PageHeader title="Конструктор полей профиля" />
      <Tabs
        items={[
          { key: 'fields', label: 'Поля', children: fieldsTab },
          { key: 'schemes', label: 'Наборы полей', children: schemesTab },
        ]}
      />
      {fieldModal && <FieldModal field={fieldModal.field} canDropdown={can('multilingual_directories')} onClose={() => setFieldModal(null)} />}
      {schemeModal && <SchemeModal scheme={schemeModal.scheme} data={d} onClose={() => setSchemeModal(null)} />}
    </>
  );
}
