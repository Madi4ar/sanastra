import { Alert, App, Button, Card, Empty, Image, Input, Progress, Select, Space, Tabs, Tag, Tree, Typography } from 'antd';
import dayjs from 'dayjs';
import { BookOpen, Play } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { CourseElement, ProfileFieldDefinition } from '@/api/types';
import { useTenantContext } from '@/features/tenant/access';
import { getStructure } from '@/mocks/courseBuilder';
import { findCourse } from '@/mocks/content';
import { load } from '@/mocks/db';
import { itemName } from '@/mocks/directories';
import { loadStructure, syncMembers } from '@/mocks/orgStructure';
import { loadProfileFields, profileValueKey, progressFor, saveProfileFields } from '@/mocks/profileFields';
import { fullNameOf, loadUsers } from '@/mocks/users';
import { formatDate } from '@/shared/format';
import { PageHeader } from './PageHeader';

function learnerGroups(clientSlug: string, userId: string) {
  const org = load().organizations.find((x) => x.clientSlug === clientSlug);
  if (!org) return { org: null, groups: [] };
  const store = syncMembers(org);
  const member = store.members.find((x) => x.tenantId === org.tenantId && x.userId === userId);
  return { org, groups: member ? store.groups.filter((g) => g.tenantId === org.tenantId && g.listenerIds.includes(member.id) && g.courseId) : [] };
}

const archive = (endDate: string) => dayjs().startOf('day').isAfter(dayjs(endDate).add(14, 'day'));

function missingRequired(tenantId: string, groupId: string, userId: string) {
  const store = loadProfileFields();
  const schemeId = loadStructure().groups.find((g) => g.id === groupId)?.profileSchemeId;
  const scheme = store.schemes.find((s) => s.id === schemeId);
  const values = store.values[profileValueKey(tenantId, groupId, userId)] ?? {};
  return scheme?.fields.filter((f) => f.required && !values[f.fieldId]?.trim()).length ?? 0;
}

export function LearnerCoursesPage() {
  const { clientSlug, user, access } = useTenantContext();
  const navigate = useNavigate();
  const { modal } = App.useApp();
  if (!user || !access) return null;
  const { org, groups } = learnerGroups(clientSlug, user.id);
  const structure = loadStructure();
  const users = loadUsers();
  return <>
    <PageHeader title="Мои курсы" />
    {!groups.length ? <Card><Empty description="Нет курсов" /></Card> : <div className="grid gap-5 lg:grid-cols-2">
      {groups.map((group) => {
        const course = org && group.courseId ? findCourse(org, group.courseId) : null;
        if (!course) return null;
        const modules = getStructure(course.id);
        const elements = modules.flatMap((m) => m.days.flatMap((d) => d.elements.filter((e) => !e.hidden)));
        const progress = progressFor(group.id, user.id);
        const percent = elements.length ? Math.round(progress.completedElementIds.filter((id) => elements.some((e) => e.id === id)).length / elements.length * 100) : 0;
        const isBefore = dayjs().isBefore(dayjs(group.startDate), 'day');
        const isArchive = archive(group.endDate);
        const trainerNames = group.trainerIds.flatMap((id) => { const t = structure.trainers.find((x) => x.id === id); const u = t && users.find((x) => x.id === t.userId); return u ? [fullNameOf(u)] : []; });
        const label = isArchive ? 'Обзор курса' : percent > 0 ? 'Продолжить курс' : 'Начать курс';
        return <Card key={group.id} cover={course.coverUrl ? <Image height={190} preview={false} src={course.coverUrl} className="object-cover" /> : <div className="flex h-48 items-center justify-center bg-primary-soft"><BookOpen size={48} className="text-primary" /></div>}>
          <Typography.Title level={4}>{course.title}</Typography.Title>
          <Space direction="vertical" size={2} className="mb-4"><span>{formatDate(group.startDate)} — {formatDate(group.endDate)}</span><span>Тренер: {trainerNames.join(', ') || '—'}</span><span>Формат: {itemName(group.formatId) ?? '—'}</span></Space>
          <Progress percent={percent} />
          <Button type="primary" icon={<Play size={16} />} onClick={() => {
            if (isBefore) return modal.info({ title: 'Курс еще не начался', content: `Курс еще не начался. Пожалуйста, ожидайте даты начала ${formatDate(group.startDate)}` });
            const missing = missingRequired(access.tenantId, group.id, user.id);
            if (missing) return navigate('/learn/profile');
            navigate(`/learn/courses/${group.id}`);
          }}>{label}</Button>
        </Card>;
      })}
    </div>}
  </>;
}

export function LearnerProfilePage() {
  const { clientSlug, user, access } = useTenantContext();
  const { message } = App.useApp();
  const [, render] = useState(0);
  if (!user || !access) return null;
  const { groups } = learnerGroups(clientSlug, user.id);
  const store = loadProfileFields();
  const allFields = [...store.globals, ...store.custom];
  const defaultValue = (field: ProfileFieldDefinition) => ({ ИИН: user.iin, ФИО: user.fullName, Email: user.email, Телефон: user.phone, Область: user.region }[field.labelRu] ?? '');
  const tabs = groups.map((group) => {
    const scheme = store.schemes.find((s) => s.id === group.profileSchemeId);
    const key = profileValueKey(access.tenantId, group.id, user.id);
    const values = store.values[key] ?? {};
    const fields = scheme?.fields.flatMap((row) => { const f = allFields.find((x) => x.id === row.fieldId); return f ? [{ ...f, required: row.required }] : []; }) ?? [];
    for (const f of fields) if (values[f.id] === undefined && defaultValue(f)) values[f.id] = defaultValue(f);
    const missing = fields.filter((f) => f.required && !values[f.id]?.trim()).length;
    return { key: group.id, label: group.name, children: <Card>
      {missing > 0 && <Alert className="mb-5" type="warning" showIcon title={`Заполните еще ${missing} полей для доступа к обучению`} />}
      <div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.id} className="flex flex-col gap-1.5"><span className="text-sm font-medium">{field.labelRu}{field.required ? ' *' : ''}</span>{field.type === 'DROPDOWN' ? <Select status={field.required && !values[field.id]?.trim() ? 'error' : undefined} value={values[field.id] || undefined} options={field.options.map((o) => ({ value: o.id, label: o.labelRu }))} onChange={(v) => { values[field.id] = v; store.values[key] = values; saveProfileFields(store); render((n) => n + 1); }} /> : <Input status={field.required && !values[field.id]?.trim() ? 'error' : undefined} value={values[field.id] ?? ''} onChange={(e) => { values[field.id] = e.target.value; store.values[key] = values; saveProfileFields(store); render((n) => n + 1); }} />}</label>)}</div>
      <Button className="mt-5" type="primary" onClick={() => { store.values[key] = values; saveProfileFields(store); render((n) => n + 1); message.success('Профиль сохранён'); }}>Сохранить</Button>
    </Card> };
  });
  return <><PageHeader title="Профиль" />{tabs.length ? <Tabs items={tabs} /> : <Card><Empty description="Нет анкет учебных групп" /></Card>}</>;
}

export function LearnerCoursePage() {
  const { groupId = '' } = useParams();
  const { clientSlug, user, access } = useTenantContext();
  const [, render] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  if (!user || !access) return null;
  const { org, groups } = learnerGroups(clientSlug, user.id);
  const group = groups.find((g) => g.id === groupId);
  const course = org && group?.courseId ? findCourse(org, group.courseId) : null;
  const modules = course ? getStructure(course.id) : [];
  const elements = modules.flatMap((m) => m.days.flatMap((d) => d.elements.filter((e) => !e.hidden)));
  if (!group || !course) return <Empty description="Курс не найден" />;
  const readonly = archive(group.endDate);
  const progress = progressFor(group.id, user.id);
  const selected: CourseElement | undefined = elements.find((e) => e.id === selectedId) ?? elements.find((e) => !progress.completedElementIds.includes(e.id)) ?? elements[0];
  const percent = elements.length ? Math.round(progress.completedElementIds.filter((id) => elements.some((e) => e.id === id)).length / elements.length * 100) : 0;
  const tree = modules.map((m) => ({ key: m.id, title: m.title, children: m.days.map((d) => ({ key: d.id, title: d.title, children: d.elements.filter((e) => !e.hidden).map((e) => ({ key: e.id, title: e.titleRu })) })) }));
  return <><PageHeader title={course.title} /><Progress percent={percent} className="mb-5" />{readonly && <Alert className="mb-5" type="info" showIcon title="Курс находится в архиве. Доступен только обзор материалов без повторного прохождения." />}<div className="grid gap-5 lg:grid-cols-[320px_1fr]"><Card title="Содержание"><Tree defaultExpandAll treeData={tree} selectedKeys={selected ? [selected.id] : []} onSelect={(keys) => { const el = elements.find((e) => e.id === keys[0]); if (el) setSelectedId(el.id); }} /></Card><Card title={selected?.titleRu ?? 'Материал'}>{selected ? <><Tag>{selected.type}</Tag><Typography.Paragraph className="mt-4">{selected.titleRu}</Typography.Paragraph>{!readonly && <Button type="primary" disabled={progress.completedElementIds.includes(selected.id)} onClick={() => { progress.completedElementIds.push(selected.id); saveProfileFields(loadProfileFields()); render((n) => n + 1); }}>{progress.completedElementIds.includes(selected.id) ? 'Пройдено' : 'Отметить пройденным'}</Button>}</> : <Empty description="Выберите элемент" />}</Card></div></>;
}
