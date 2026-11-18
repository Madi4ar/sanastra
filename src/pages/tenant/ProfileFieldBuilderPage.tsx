import { App, Button, Card, Checkbox, Divider, Input, Modal, Select, Space, Switch, Table, Tabs, Tag } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProfileFieldDefinition, ProfileFieldOption, ProfileFieldType } from '@/api/types';
import { useTenantContext } from '@/features/tenant/access';
import { fieldsForTenant, loadProfileFields, saveProfileFields, schemesForTenant } from '@/mocks/profileFields';
import { PageHeader } from './PageHeader';

const blankOption = (): ProfileFieldOption => ({ id: crypto.randomUUID(), labelKz: '', labelRu: '', labelEn: '' });

export function ProfileFieldBuilderPage() {
  const { access } = useTenantContext();
  const tenantId = access?.tenantId ?? '';
  const { message } = App.useApp();
  const [, render] = useState(0);
  const [fieldOpen, setFieldOpen] = useState(false);
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [labels, setLabels] = useState({ labelKz: '', labelRu: '', labelEn: '' });
  const [type, setType] = useState<ProfileFieldType>('TEXT');
  const [options, setOptions] = useState<ProfileFieldOption[]>([blankOption()]);
  const [schemeName, setSchemeName] = useState('');
  const [schemeFields, setSchemeFields] = useState<Record<string, { selected: boolean; required: boolean }>>({});
  if (!tenantId) return null;
  const store = loadProfileFields();
  const tenantFields = fieldsForTenant(tenantId);
  const tenantSchemes = schemesForTenant(tenantId);
  const refresh = () => render((n) => n + 1);
  const toggleGlobal = (id: string, active: boolean) => {
    const current = store.tenantActive[tenantId] ?? store.globals.filter((f) => f.active).map((f) => f.id);
    store.tenantActive[tenantId] = active ? [...new Set([...current, id])] : current.filter((x) => x !== id);
    saveProfileFields(store); refresh();
  };
  const createField = () => {
    if (!labels.labelKz.trim() || !labels.labelRu.trim() || !labels.labelEn.trim()) return message.error('Заполните название на трёх языках');
    if (type === 'DROPDOWN' && options.some((o) => !o.labelKz.trim() || !o.labelRu.trim() || !o.labelEn.trim())) return message.error('Заполните варианты на трёх языках');
    store.custom.push({ id: crypto.randomUUID(), tenantId, system: false, active: true, ...labels, type, options: type === 'DROPDOWN' ? options : [] });
    saveProfileFields(store); setFieldOpen(false); setLabels({ labelKz: '', labelRu: '', labelEn: '' }); setType('TEXT'); setOptions([blankOption()]); refresh();
  };
  const createScheme = () => {
    if (!schemeName.trim()) return message.error('Укажите название схемы');
    const selected = Object.entries(schemeFields).filter(([, v]) => v.selected).map(([fieldId, v]) => ({ fieldId, required: v.required }));
    if (!selected.length) return message.error('Выберите поля схемы');
    store.schemes.push({ id: crypto.randomUUID(), tenantId, name: schemeName.trim(), fields: selected });
    saveProfileFields(store); setSchemeOpen(false); setSchemeName(''); setSchemeFields({}); refresh();
  };
  const fieldTab = <>
    <Card title="Глобальные поля">
      <Table rowKey="id" pagination={false} dataSource={store.globals.filter((f) => f.active)} columns={[
        { title: 'Поле', dataIndex: 'labelRu' },
        { title: 'Активно для компании', width: 180, render: (_, f: ProfileFieldDefinition) => <Switch checked={tenantFields.some((x) => x.id === f.id)} onChange={(v) => toggleGlobal(f.id, v)} /> },
      ]} />
    </Card>
    <Card className="mt-4" title="Пользовательские поля" extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => setFieldOpen(true)}>Создать поле</Button>}>
      <Table rowKey="id" pagination={false} dataSource={store.custom.filter((f) => f.tenantId === tenantId)} columns={[
        { title: 'Название (KZ)', dataIndex: 'labelKz' }, { title: 'Название (RU)', dataIndex: 'labelRu' }, { title: 'Название (EN)', dataIndex: 'labelEn' },
        { title: 'Тип', render: (_, f: ProfileFieldDefinition) => <Tag>{f.type === 'DROPDOWN' ? 'Выпадающий список' : 'Текст'}</Tag> },
      ]} />
    </Card>
  </>;
  const schemesTab = <Card title="Схемы полей" extra={<Button type="primary" icon={<Plus size={16} />} onClick={() => setSchemeOpen(true)}>Создать схему</Button>}>
    <label className="mb-5 flex max-w-md flex-col gap-1.5"><span className="text-sm font-medium">Схема анкеты тренера</span><Select allowClear placeholder="Не выбрана" value={store.trainerSchemeByTenant[tenantId]} options={tenantSchemes.map((scheme) => ({ value: scheme.id, label: scheme.name }))} onChange={(value) => { const next = structuredClone(loadProfileFields()); if (value) next.trainerSchemeByTenant[tenantId] = value; else delete next.trainerSchemeByTenant[tenantId]; saveProfileFields(next); refresh(); }} /></label>
    <Table rowKey="id" pagination={false} dataSource={tenantSchemes} columns={[
      { title: 'Название', dataIndex: 'name' },
      { title: 'Поля', render: (_, s) => s.fields.length },
      { title: 'Обязательные', render: (_, s) => s.fields.filter((f: { required: boolean }) => f.required).length },
    ]} />
  </Card>;
  return <>
    <PageHeader title="Конструктор полей профиля" />
    <Tabs items={[{ key: 'fields', label: 'Поля', children: fieldTab }, { key: 'schemes', label: 'Схемы полей', children: schemesTab }]} />
    <Modal open={fieldOpen} title="Новое пользовательское поле" okText="Создать" cancelText="Отмена" onOk={createField} onCancel={() => setFieldOpen(false)} width={640} destroyOnHidden>
      <Space direction="vertical" className="w-full"><Input placeholder="Название (KZ)" value={labels.labelKz} onChange={(e) => setLabels({ ...labels, labelKz: e.target.value })} /><Input placeholder="Название (RU)" value={labels.labelRu} onChange={(e) => setLabels({ ...labels, labelRu: e.target.value })} /><Input placeholder="Название (EN)" value={labels.labelEn} onChange={(e) => setLabels({ ...labels, labelEn: e.target.value })} /><Select className="w-full" value={type} options={[{ value: 'TEXT', label: 'Текст' }, { value: 'DROPDOWN', label: 'Выпадающий список' }]} onChange={setType} />
      {type === 'DROPDOWN' && <><Divider>Варианты ответа</Divider>{options.map((o, i) => <Space.Compact key={o.id} className="w-full"><Input placeholder="KZ" value={o.labelKz} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, labelKz: e.target.value } : x))} /><Input placeholder="RU" value={o.labelRu} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, labelRu: e.target.value } : x))} /><Input placeholder="EN" value={o.labelEn} onChange={(e) => setOptions(options.map((x, j) => j === i ? { ...x, labelEn: e.target.value } : x))} /><Button aria-label="Удалить вариант" icon={<Trash2 size={15} />} onClick={() => setOptions(options.filter((_, j) => j !== i))} /></Space.Compact>)}<Button icon={<Plus size={15} />} onClick={() => setOptions([...options, blankOption()])}>Добавить вариант</Button></>}
      </Space>
    </Modal>
    <Modal open={schemeOpen} title="Новая схема полей" okText="Создать" cancelText="Отмена" onOk={createScheme} onCancel={() => setSchemeOpen(false)} width={640} destroyOnHidden>
      <Input className="mb-4" placeholder="Название схемы" value={schemeName} onChange={(e) => setSchemeName(e.target.value)} />
      <Table rowKey="id" pagination={false} dataSource={tenantFields} columns={[{ title: 'Поле', dataIndex: 'labelRu' }, { title: 'Включить', render: (_, f: ProfileFieldDefinition) => <Checkbox checked={schemeFields[f.id]?.selected} onChange={(e) => setSchemeFields({ ...schemeFields, [f.id]: { selected: e.target.checked, required: schemeFields[f.id]?.required ?? false } })} /> }, { title: 'Обязательное', render: (_, f: ProfileFieldDefinition) => <Checkbox disabled={!schemeFields[f.id]?.selected} checked={schemeFields[f.id]?.required} onChange={(e) => setSchemeFields({ ...schemeFields, [f.id]: { selected: true, required: e.target.checked } })} /> }]} />
    </Modal>
  </>;
}
