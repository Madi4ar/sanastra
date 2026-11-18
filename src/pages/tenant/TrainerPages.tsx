import { Alert, App, Button, Card, Checkbox, Empty, Image, Input, Select, Space, Table, Tabs, Tag, Tree, Typography, type TableColumnsType } from 'antd';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { CourseElement, ProfileFieldDefinition } from '@/api/types';
import { ElementPreview } from '@/features/course-builder/ElementPreview';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { useTenantContext } from '@/features/tenant/access';
import { getStructure } from '@/mocks/courseBuilder';
import { findCourse } from '@/mocks/content';
import { load } from '@/mocks/db';
import { itemName } from '@/mocks/directories';
import { syncMembers, type GroupRecord, type Member } from '@/mocks/orgStructure';
import { loadProfileFields, profileValueKey, saveProfileFields } from '@/mocks/profileFields';
import { formatDate } from '@/shared/format';
import { richTextToPlain } from '@/shared/richText';
import { PageHeader } from './PageHeader';

function trainerData(clientSlug: string, userId: string) {
  const org = load().organizations.find((item) => item.clientSlug === clientSlug);
  if (!org) return { org: null, store: null, groups: [] as GroupRecord[] };
  const store = syncMembers(org);
  const trainer = store.trainers.find((item) => item.tenantId === org.tenantId && item.userId === userId && item.active);
  return { org, store, groups: trainer ? store.groups.filter((group) => group.tenantId === org.tenantId && group.trainerIds.includes(trainer.id) && group.courseId) : [] };
}

export function TrainerCoursesPage() {
  const { clientSlug, user } = useTenantContext();
  const navigate = useNavigate();
  const [year, setYear] = useState('ALL');
  if (!user) return null;
  const { org, groups } = trainerData(clientSlug, user.id);
  const years = [...new Set(groups.map((group) => group.academicYear))].sort().reverse();
  const visible = year === 'ALL' ? groups : groups.filter((group) => group.academicYear === year);
  return <>
    <PageHeader title="Мои курсы" />
    <Card className="mb-5"><label className="flex max-w-xs flex-col gap-1.5"><span className="text-sm font-medium">Учебный год</span><Select aria-label="Учебный год" value={year} options={[{ value: 'ALL', label: 'Все годы' }, ...years.map((value) => ({ value, label: value }))]} onChange={setYear} /></label></Card>
    {!visible.length ? <Card><Empty description="Нет закреплённых групп" /></Card> : <div className="grid gap-5 lg:grid-cols-2">{visible.map((group) => {
      const course = org && group.courseId ? findCourse(org, group.courseId) : null;
      if (!course) return null;
      return <Card key={group.id} cover={course.coverUrl ? <Image height={190} preview={false} src={course.coverUrl} className="object-cover" /> : <div className="flex h-48 items-center justify-center bg-primary-soft"><BookOpen size={48} className="text-primary" /></div>}>
        <Typography.Title level={4}>{course.title}</Typography.Title>
        <Space orientation="vertical" size={2} className="mb-4"><span>Шифр группы: {group.name}</span><span>Формат: {itemName(group.formatId) ?? '—'}</span><span>Количество слушателей: {group.listenerIds.length}</span><span>Период обучения: {formatDate(group.startDate)} — {formatDate(group.endDate)}</span></Space>
        <div><Button type="primary" icon={<ExternalLink size={16} />} onClick={() => navigate(`/trainer/courses/${group.id}`)}>Перейти</Button></div>
      </Card>;
    })}</div>}
  </>;
}

function elementStatus(element: CourseElement, groupId: string, userId?: string) {
  const progress = userId ? loadProfileFields().progress.find((item) => item.groupId === groupId && item.userId === userId) : undefined;
  const done = Boolean(progress?.completedElementIds.includes(element.id));
  if (element.type === 'test') {
    const grade = progress?.grades[element.id];
    return grade !== undefined ? `Сдан: ${grade}` : progress?.answers[element.id] !== undefined ? 'В процессе' : 'Не сдан';
  }
  if (element.type === 'assignment' || element.type === 'reflection') {
    return progress?.grades[element.id] !== undefined ? 'Выполнено' : progress?.answers[element.id] !== undefined ? 'На проверке' : 'Не приступал';
  }
  return done ? 'Просмотрено' : 'Не просмотрено';
}

function GroupSelect({ groups, value, onChange }: { groups: GroupRecord[]; value: string; onChange: (value: string) => void }) {
  return <label className="flex min-w-64 flex-col gap-1.5"><span className="text-sm font-medium">Шифр группы</span><Select aria-label="Шифр группы" value={value} options={groups.map((group) => ({ value: group.id, label: group.name }))} onChange={onChange} /></label>;
}

export function TrainerCoursePage() {
  const { groupId = '' } = useParams();
  const { clientSlug, user } = useTenantContext();
  const [, refresh] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [attendanceGroupId, setAttendanceGroupId] = useState('');
  const [progressGroupId, setProgressGroupId] = useState('');
  const [search, setSearch] = useState('');
  if (!user) return null;
  const { org, store, groups } = trainerData(clientSlug, user.id);
  const sourceGroup = groups.find((group) => group.id === groupId);
  const course = org && sourceGroup?.courseId ? findCourse(org, sourceGroup.courseId) : null;
  if (!store || !sourceGroup || !course) return <Empty description="Курс не найден" />;
  const courseGroups = groups.filter((group) => group.courseId === sourceGroup.courseId).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const latestId = courseGroups[0]?.id ?? sourceGroup.id;
  const selectedAttendanceGroup = courseGroups.find((group) => group.id === (attendanceGroupId || latestId)) ?? sourceGroup;
  const selectedProgressGroup = courseGroups.find((group) => group.id === (progressGroupId || latestId)) ?? sourceGroup;
  const modules = getStructure(course.id);
  const days = modules.flatMap((module) => module.days);
  const elements = days.flatMap((day) => day.elements.filter((element) => !element.hidden));
  const selected = elements.find((element) => element.id === selectedElementId) ?? elements[0];
  const tree = modules.map((module) => ({ key: module.id, title: module.title, children: module.days.map((day) => ({ key: day.id, title: day.title, children: day.elements.filter((element) => !element.hidden).map((element) => ({ key: element.id, title: element.titleRu })) })) }));
  const listeners = (group: GroupRecord) => group.listenerIds.flatMap((id) => { const member = store.members.find((item) => item.id === id); return member ? [member] : []; });
  const profileStore = loadProfileFields();
  const attendanceColumns: TableColumnsType<Member> = [
    { title: 'ФИО слушателя', dataIndex: 'fullName', fixed: 'left', width: 220 },
    ...days.map((day) => ({ title: day.title, width: 150, render: (_: unknown, member: Member) => { const key = `${selectedAttendanceGroup.id}:${day.id}:${member.id}`; return <Checkbox checked={Boolean(profileStore.attendance[key])} onChange={(event) => { const next = structuredClone(loadProfileFields()); next.attendance[key] = event.target.checked; saveProfileFields(next); refresh((value) => value + 1); }} />; } })),
  ];
  const progressListeners = listeners(selectedProgressGroup).filter((member) => member.fullName.toLowerCase().includes(search.trim().toLowerCase()));
  const progressColumns: TableColumnsType<Member> = [
    { title: 'ФИО слушателя', dataIndex: 'fullName', fixed: 'left', width: 220 },
    ...elements.map((element) => ({ title: element.titleRu, width: 180, render: (_: unknown, member: Member) => elementStatus(element, selectedProgressGroup.id, member.userId) })),
  ];
  const content = <div className="grid gap-5 lg:grid-cols-[320px_1fr]"><Card title="Структура курса"><Tree defaultExpandAll treeData={tree} selectedKeys={selected ? [selected.id] : []} onSelect={(keys) => { const element = elements.find((item) => item.id === keys[0]); if (element) setSelectedElementId(element.id); }} /></Card><Card title={selected?.titleRu ?? 'Материал'}>{selected ? <><Tag>{selected.type}</Tag><Typography.Paragraph className="mt-4">{selected.titleRu}</Typography.Paragraph><Button onClick={() => setPreviewOpen(true)}>Открыть элемент</Button><Alert className="mt-4" type="info" showIcon title="Режим симуляции: результат не сохраняется в прогресс и аналитику группы" /></> : <Empty description="Нет элементов" />}</Card></div>;
  const about = <Card title="О курсе"><Typography.Title level={4}>{course.title}</Typography.Title><Typography.Paragraph>{richTextToPlain(course.descriptionRu)}</Typography.Paragraph><Typography.Paragraph><strong>Цель:</strong> {richTextToPlain(course.goalRu)}</Typography.Paragraph><Typography.Paragraph><strong>Результат:</strong> {richTextToPlain(course.resultRu)}</Typography.Paragraph></Card>;
  const attendance = <><div className="mb-4"><GroupSelect groups={courseGroups} value={selectedAttendanceGroup.id} onChange={setAttendanceGroupId} /></div><Table rowKey="id" bordered pagination={false} scroll={{ x: 'max-content' }} dataSource={listeners(selectedAttendanceGroup)} columns={attendanceColumns} /></>;
  const progress = <><div className="mb-4 flex flex-wrap items-end gap-4"><GroupSelect groups={courseGroups} value={selectedProgressGroup.id} onChange={setProgressGroupId} /><label className="flex min-w-64 flex-col gap-1.5"><span className="text-sm font-medium">Поиск по ФИО</span><Input allowClear value={search} onChange={(event) => setSearch(event.target.value)} /></label></div><Table rowKey="id" bordered pagination={false} scroll={{ x: 'max-content' }} dataSource={progressListeners} columns={progressColumns} /></>;
  return <><PageHeader title={course.title} /><Tabs items={[{ key: 'content', label: 'Содержание', children: content }, { key: 'about', label: 'О курсе', children: about }, { key: 'attendance', label: 'Ведомость', children: attendance }, { key: 'progress', label: 'Выполнение элементов курса', children: progress }]} />{previewOpen && selected && <ElementPreview element={selected} onClose={() => setPreviewOpen(false)} />}</>;
}

export function TrainerProfilePage() {
  const { user, access } = useTenantContext();
  const { message } = App.useApp();
  const [, refresh] = useState(0);
  if (!user || !access) return null;
  const store = loadProfileFields();
  const scheme = store.schemes.find((item) => item.id === store.trainerSchemeByTenant[access.tenantId]);
  const rows = [...store.globalTrainerFields, ...(scheme?.fields ?? [])].reduce<{ fieldId: string; required: boolean }[]>((result, row) => {
    const current = result.find((item) => item.fieldId === row.fieldId);
    if (current) current.required ||= row.required;
    else result.push({ ...row });
    return result;
  }, []);
  const fields = rows.flatMap((row) => { const field = [...store.globals, ...store.custom].find((item) => item.id === row.fieldId && item.active); return field ? [{ ...field, required: row.required }] : []; });
  const key = profileValueKey(access.tenantId, 'trainer', user.id);
  const values = { ...(store.values[key] ?? {}) };
  const base = (field: ProfileFieldDefinition) => ({ ИИН: user.iin, ФИО: user.fullName, Email: user.email, Телефон: user.phone, Область: user.region }[field.labelRu] ?? '');
  for (const field of fields) if (values[field.id] === undefined && base(field)) values[field.id] = base(field);
  const missing = fields.filter((field) => field.required && !values[field.id]?.trim()).length;
  const saveValues = (nextValues: Record<string, string>) => { const next = structuredClone(loadProfileFields()); next.values[key] = nextValues; saveProfileFields(next); refresh((n) => n + 1); };
  return <><PageHeader title="Профиль" /><ProfileCard user={user} organizationName={access.organizationName} />{fields.length > 0 && <Card className="mt-5" title="Дополнительные поля">{missing > 0 && <Alert className="mb-5" type="warning" showIcon title={`Заполните еще ${missing} полей`} description="Заполните обязательные поля профиля тренера." />}<div className="grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.id} className="flex flex-col gap-1.5"><span className="text-sm font-medium">{field.labelRu}{field.required ? ' *' : ''}</span>{field.type === 'DROPDOWN' ? <Select status={field.required && !values[field.id]?.trim() ? 'error' : undefined} value={values[field.id] || undefined} options={field.options.map((option) => ({ value: option.id, label: option.labelRu }))} onChange={(value) => saveValues({ ...values, [field.id]: value })} /> : <Input status={field.required && !values[field.id]?.trim() ? 'error' : undefined} value={values[field.id] ?? ''} onChange={(event) => saveValues({ ...values, [field.id]: event.target.value })} />}</label>)}</div><Button className="mt-5" type="primary" onClick={() => { saveValues(values); message.success('Профиль сохранён'); }}>Сохранить</Button></Card>}</>;
}
