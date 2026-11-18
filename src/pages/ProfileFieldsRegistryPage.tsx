import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Modal, Switch, Table, Tag, Typography } from 'antd';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { GlobalProfileField, GlobalProfileFieldPayload } from '@/api/types';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { FieldForm } from './tenant/ProfileFieldBuilderPage';

const toPayload = (f: GlobalProfileField | null): GlobalProfileFieldPayload =>
  f
    ? { labelKz: f.labelKz, labelRu: f.labelRu, labelEn: f.labelEn, type: f.type, options: f.options, active: f.active, inTrainerProfile: f.inTrainerProfile, trainerRequired: f.trainerRequired }
    : { labelKz: '', labelRu: '', labelEn: '', type: 'TEXT', options: [], active: true, inTrainerProfile: false, trainerRequired: false };

function GlobalFieldModal({ field, onClose }: { field: GlobalProfileField | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [values, setValues] = useState(() => toPayload(field));
  const save = useMutation({
    mutationFn: () => (field ? api.profileFieldsRegistry.update(field.id, values) : api.profileFieldsRegistry.create(values)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.profileFieldsRegistry });
      onClose();
    },
  });
  const errors = isApiError(save.error) ? save.error.fieldErrors : {};
  const set = (patch: Partial<GlobalProfileFieldPayload>) => {
    setValues((v) => ({ ...v, ...patch }));
    save.reset();
  };
  return (
    <Modal open title={field ? 'Редактирование глобального поля' : 'Новое глобальное поле'} okText={field ? 'Сохранить' : 'Создать'} cancelText="Отмена" confirmLoading={save.isPending} onOk={() => save.mutate()} onCancel={onClose} width={680} destroyOnHidden>
      <FieldForm values={values} onChange={(next) => set(next)} errors={errors} canDropdown lockType={field?.accountField} />
      {field?.accountField && <p className="m-0 mt-2 text-xs text-muted">Значение берётся из учётной записи пользователя, тип поля не меняется.</p>}
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-center gap-3">
          <Switch checked={values.active} onChange={(active) => set({ active })} /> Поле активно (доступно организациям)
        </label>
        <label className="flex items-center gap-3">
          <Switch checked={values.inTrainerProfile} onChange={(inTrainerProfile) => set({ inTrainerProfile, trainerRequired: inTrainerProfile && values.trainerRequired })} /> В анкете тренера
        </label>
        <label className="flex items-center gap-3">
          <Switch disabled={!values.inTrainerProfile} checked={values.trainerRequired} onChange={(trainerRequired) => set({ trainerRequired })} /> Обязательное для тренера
        </label>
      </div>
      {save.isError && !Object.keys(errors).length && <Alert className="mt-3" type="error" showIcon title={save.error.message} />}
    </Modal>
  );
}

export function ProfileFieldsRegistryPage() {
  const list = useQuery({ queryKey: queryKeys.profileFieldsRegistry, queryFn: () => api.profileFieldsRegistry.list() });
  const [editing, setEditing] = useState<{ field: GlobalProfileField | null } | null>(null);
  return (
    <div className="flex flex-col gap-4 pb-6">
      <Typography.Title level={3} style={{ margin: 0 }}>
        Поля профиля
      </Typography.Title>
      <Card title="Глобальные поля профиля" extra={<Button type="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setEditing({ field: null })}>Добавить поле</Button>}>
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <Table
            rowKey="id"
            loading={list.isPending}
            pagination={false}
            dataSource={list.data}
            columns={[
              { title: 'Поле', render: (_, f) => <>{f.labelRu} <span className="text-xs text-muted">· {f.labelKz} · {f.labelEn}</span></> },
              {
                title: 'Тип',
                render: (_, f) => (
                  <div>
                    <Tag>{f.type === 'DROPDOWN' ? 'Выпадающий список' : 'Текст'}</Tag>
                    {f.type === 'DROPDOWN' && <div className="mt-1 text-xs text-muted">{f.options.map((o) => o.labelRu).join(', ')}</div>}
                  </div>
                ),
              },
              { title: 'Статус', width: 120, render: (_, f) => (f.active ? <Tag color="green">Активно</Tag> : <Tag>Выключено</Tag>) },
              { title: 'В анкете тренера', width: 170, render: (_, f) => (f.inTrainerProfile ? (f.trainerRequired ? 'Обязательное' : 'Опциональное') : '—') },
              { title: '', width: 56, render: (_, f) => <IconButton type="text" label={`Изменить поле ${f.labelRu}`} icon={<Pencil size={15} />} onClick={() => setEditing({ field: f })} /> },
            ]}
          />
        )}
      </Card>
      {editing && <GlobalFieldModal field={editing.field} onClose={() => setEditing(null)} />}
    </div>
  );
}
