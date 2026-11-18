import { Card, Switch, Table } from 'antd';
import { useState } from 'react';
import type { ProfileFieldDefinition } from '@/api/types';
import { loadProfileFields, saveProfileFields } from '@/mocks/profileFields';

export function ProfileFieldsRegistryPage() {
  const [, render] = useState(0);
  const store = loadProfileFields();
  const updateTrainerField = (fieldId: string, selected: boolean, required = false) => {
    const next = structuredClone(loadProfileFields());
    next.globalTrainerFields = selected
      ? [...next.globalTrainerFields.filter((item) => item.fieldId !== fieldId), { fieldId, required }]
      : next.globalTrainerFields.filter((item) => item.fieldId !== fieldId);
    saveProfileFields(next);
    render((n) => n + 1);
  };
  return <Card title="Глобальные поля профиля">
    <Table rowKey="id" pagination={false} dataSource={store.globals} columns={[
      { title: 'Поле', dataIndex: 'labelRu' },
      { title: 'Активно', width: 120, render: (_, field: ProfileFieldDefinition) => <Switch checked={field.active} onChange={(active) => { field.active = active; saveProfileFields(store); render((n) => n + 1); }} /> },
      { title: 'В анкете тренера', width: 180, render: (_, field: ProfileFieldDefinition) => { const row = store.globalTrainerFields.find((item) => item.fieldId === field.id); return <Switch checked={Boolean(row)} onChange={(selected) => updateTrainerField(field.id, selected, row?.required)} />; } },
      { title: 'Обязательное', width: 150, render: (_, field: ProfileFieldDefinition) => { const row = store.globalTrainerFields.find((item) => item.fieldId === field.id); return <Switch disabled={!row} checked={Boolean(row?.required)} onChange={(required) => updateTrainerField(field.id, true, required)} />; } },
    ]} />
  </Card>;
}
