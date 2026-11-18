import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Empty, Input, Select, Skeleton, Table, Tabs, Tooltip, Tree, Typography, type TableColumnsType } from 'antd';
import { Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { AttendanceSheet, CourseElement, ElementProgress, ProgressMatrix, TrainerCourseView } from '@/api/types';
import { courseElements, courseTree, ProfileFormView, ProgressTag, TestRunner } from '@/features/cabinet/CourseParts';
import { ElementContent, ElementPreview } from '@/features/course-builder/ElementPreview';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { useTenantContext } from '@/features/tenant/access';
import { formatDate } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { CourseCover } from './LearnerPages';
import { PageHeader } from './PageHeader';

export function TrainerCoursesPage() {
  const { clientSlug, base } = useTenantContext();
  const navigate = useNavigate();
  const [year, setYear] = useState('ALL');
  const courses = useQuery({ queryKey: queryKeys.trainerCourses(clientSlug), queryFn: () => api.cabinet(clientSlug).trainerCourses() });
  const years = [...new Set((courses.data ?? []).map((c) => c.academicYear))].sort().reverse();
  const visible = (courses.data ?? []).filter((c) => year === 'ALL' || c.academicYear === year);

  return (
    <>
      <PageHeader title="Мои курсы" />
      <Card className="mb-5">
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="text-sm font-medium">Учебный год</span>
          <Select aria-label="Учебный год" value={year} options={[{ value: 'ALL', label: 'Все годы' }, ...years.map((value) => ({ value, label: value }))]} onChange={setYear} />
        </label>
      </Card>
      {courses.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
      ) : !visible.length ? (
        <Card>
          <Empty description="Нет закреплённых групп" />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {visible.map((card) => (
            <Card key={card.groupId} cover={<CourseCover title={card.courseTitle} coverUrl={card.coverUrl} />}>
              <Typography.Title level={4}>{card.courseTitle}</Typography.Title>
              <div className="mb-4 flex flex-col gap-0.5">
                <span>Шифр группы: {card.groupCode}</span>
                <span>Формат: {card.formatName ?? '—'}</span>
                <span>Количество слушателей: {card.listenersCount}</span>
                <span>Период обучения: {formatDate(card.startDate)} — {formatDate(card.endDate)}</span>
              </div>
              {/* Без блокировки по дате: тренер готовится к занятиям заранее */}
              <Button type="primary" icon={<ExternalLink size={16} aria-hidden />} onClick={() => navigate(`${base}/courses/${card.groupId}`)}>
                Перейти
              </Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function GroupSelect({ groups, value, onChange }: { groups: TrainerCourseView['groups']; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex min-w-64 flex-col gap-1.5">
      <span className="text-sm font-medium">Шифр группы</span>
      <Select aria-label="Шифр группы" value={value} options={groups.map((g) => ({ value: g.id, label: g.code }))} onChange={onChange} />
    </label>
  );
}

function Sandbox({ view, clientSlug }: { view: TrainerCourseView; clientSlug: string }) {
  const elements = courseElements(view.modules);
  const [selectedId, setSelectedId] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const selected: CourseElement | undefined = elements.find((e) => e.id === selectedId) ?? elements[0];
  if (!elements.length) return <Card><Empty description="В программе пока нет элементов" /></Card>;
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <Card title="Структура курса">
        <Tree
          defaultExpandAll
          treeData={courseTree(view.modules)}
          selectedKeys={selected ? [selected.id] : []}
          onSelect={(keys) => {
            const element = elements.find((e) => e.id === keys[0]);
            if (element) setSelectedId(element.id);
          }}
        />
      </Card>
      <Card title={selected?.titleRu} extra={selected && <Button onClick={() => setPreviewOpen(true)}>Открыть элемент</Button>}>
        <Alert className="mb-4" type="info" showIcon title="Режим симуляции: результат не сохраняется в прогресс и аналитику группы" />
        {selected?.type === 'test' ? (
          <TestRunner key={selected.id} element={selected} dryRun onSubmit={(answers) => api.cabinet(clientSlug).dryRunTest(view.groupId, selected.id, answers)} />
        ) : (
          selected && <ElementContent element={selected} />
        )}
      </Card>
      {previewOpen && selected && <ElementPreview element={selected} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}

function AttendanceTab({ view, clientSlug }: { view: TrainerCourseView; clientSlug: string }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [groupId, setGroupId] = useState(view.groups[0]?.id ?? view.groupId);
  const key = queryKeys.attendance(clientSlug, groupId);
  const sheet = useQuery({ queryKey: key, queryFn: () => api.cabinet(clientSlug).attendance(groupId) });
  const mark = useMutation({
    mutationFn: (v: { memberId: string; dayId: string; present: boolean }) => api.cabinet(clientSlug).markAttendance(groupId, v.memberId, v.dayId, v.present),
    onMutate: (v) => {
      qc.setQueryData<AttendanceSheet>(key, (current) =>
        current && { ...current, rows: current.rows.map((r) => (r.memberId === v.memberId ? { ...r, marks: { ...r.marks, [v.dayId]: v.present } } : r)) },
      );
    },
    onError: (error) => {
      message.error(error.message);
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const columns: TableColumnsType<AttendanceSheet['rows'][number]> = [
    { title: 'ФИО слушателя', dataIndex: 'fullName', fixed: 'left', width: 220 },
    ...(sheet.data?.days ?? []).map((day) => ({
      title: day.title,
      key: day.id,
      width: 140,
      align: 'center' as const,
      render: (_: unknown, row: AttendanceSheet['rows'][number]) => (
        <Checkbox
          aria-label={`${row.fullName}: ${day.title}`}
          checked={Boolean(row.marks[day.id])}
          onChange={(event) => mark.mutate({ memberId: row.memberId, dayId: day.id, present: event.target.checked })}
        />
      ),
    })),
  ];
  return (
    <>
      <div className="mb-4">
        <GroupSelect groups={view.groups} value={groupId} onChange={setGroupId} />
      </div>
      {sheet.isError ? (
        <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
      ) : (
        <Table rowKey="memberId" bordered loading={sheet.isPending} pagination={false} scroll={{ x: 'max-content' }} dataSource={sheet.data?.rows} columns={columns} locale={{ emptyText: 'В группе нет слушателей' }} />
      )}
    </>
  );
}

function ProgressTab({ view, clientSlug }: { view: TrainerCourseView; clientSlug: string }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [groupId, setGroupId] = useState(view.groups[0]?.id ?? view.groupId);
  const [search, setSearch] = useState('');
  const key = queryKeys.groupProgress(clientSlug, groupId);
  const matrix = useQuery({ queryKey: key, queryFn: () => api.cabinet(clientSlug).progress(groupId) });
  const accept = useMutation({
    mutationFn: (v: { memberId: string; elementId: string }) => api.cabinet(clientSlug).acceptWork(groupId, v.memberId, v.elementId),
    onSuccess: (cell, v) => {
      qc.setQueryData<ProgressMatrix>(key, (current) =>
        current && { ...current, rows: current.rows.map((r) => (r.memberId === v.memberId ? { ...r, cells: { ...r.cells, [v.elementId]: cell } } : r)) },
      );
      message.success('Работа принята');
    },
    onError: (error) => message.error(error.message),
  });
  type Row = ProgressMatrix['rows'][number];
  const rows = (matrix.data?.rows ?? []).filter((r) => r.fullName.toLowerCase().includes(search.trim().toLowerCase()));
  const columns: TableColumnsType<Row> = [
    { title: 'ФИО слушателя', dataIndex: 'fullName', fixed: 'left', width: 220 },
    ...(matrix.data?.elements ?? []).map((element) => ({
      title: element.title,
      key: element.id,
      width: 190,
      render: (_: unknown, row: Row) => {
        const cell: ElementProgress = row.cells[element.id]!;
        return (
          <div className="flex items-center gap-1">
            {cell.answer ? (
              <Tooltip title={cell.answer}>
                <span>
                  <ProgressTag progress={cell} />
                </span>
              </Tooltip>
            ) : (
              <ProgressTag progress={cell} />
            )}
            {cell.status === 'WORK_ON_REVIEW' && (
              <Button
                size="small"
                type="text"
                aria-label={`Принять работу: ${row.fullName}, ${element.title}`}
                icon={<Check size={14} aria-hidden />}
                loading={accept.isPending && accept.variables?.memberId === row.memberId && accept.variables.elementId === element.id}
                onClick={() => accept.mutate({ memberId: row.memberId, elementId: element.id })}
              />
            )}
          </div>
        );
      },
    })),
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <GroupSelect groups={view.groups} value={groupId} onChange={setGroupId} />
        <label className="flex min-w-64 flex-col gap-1.5">
          <span className="text-sm font-medium">Поиск по ФИО</span>
          <Input allowClear aria-label="Поиск по ФИО" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </div>
      {matrix.isError ? (
        <ErrorState error={matrix.error} onRetry={() => void matrix.refetch()} />
      ) : (
        <Table rowKey="memberId" bordered loading={matrix.isPending} pagination={false} scroll={{ x: 'max-content' }} dataSource={rows} columns={columns} locale={{ emptyText: 'Слушатели не найдены' }} />
      )}
    </>
  );
}

export function TrainerCoursePage() {
  const { groupId = '' } = useParams();
  const { clientSlug } = useTenantContext();
  const course = useQuery({ queryKey: queryKeys.trainerCourse(clientSlug, groupId), queryFn: () => api.cabinet(clientSlug).trainerCourse(groupId), retry: false });
  if (course.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (course.isError) return <ErrorState title="Курс недоступен" error={course.error} onRetry={() => void course.refetch()} />;
  const view = course.data;
  const about = (
    <Card title="О курсе">
      <Typography.Title level={4}>{view.course.title}</Typography.Title>
      <Typography.Paragraph>{view.course.description}</Typography.Paragraph>
      {view.course.goal && (
        <Typography.Paragraph>
          <strong>Цель:</strong> {view.course.goal}
        </Typography.Paragraph>
      )}
      {view.course.result && (
        <Typography.Paragraph>
          <strong>Ожидаемый результат:</strong> {view.course.result}
        </Typography.Paragraph>
      )}
    </Card>
  );
  return (
    <>
      <PageHeader title={view.course.title} />
      <Tabs
        items={[
          { key: 'content', label: 'Содержание', children: <Sandbox view={view} clientSlug={clientSlug} /> },
          { key: 'about', label: 'О курсе', children: about },
          { key: 'attendance', label: 'Ведомость', children: <AttendanceTab view={view} clientSlug={clientSlug} /> },
          { key: 'progress', label: 'Выполнение элементов курса', children: <ProgressTab view={view} clientSlug={clientSlug} /> },
        ]}
      />
    </>
  );
}

export function TrainerProfilePage() {
  const { clientSlug, user, access } = useTenantContext();
  const form = useQuery({ queryKey: queryKeys.profileForm(clientSlug), queryFn: () => api.cabinet(clientSlug).profileForm() });
  if (!user) return null;
  return (
    <>
      <PageHeader title="Профиль" />
      <ProfileCard user={user} organizationName={access?.organizationName} />
      <div className="mt-5">
        {form.isPending ? (
          <Skeleton active />
        ) : form.isError ? (
          <ErrorState error={form.error} onRetry={() => void form.refetch()} />
        ) : (
          <ProfileFormView form={form.data} clientSlug={clientSlug} />
        )}
      </div>
    </>
  );
}
