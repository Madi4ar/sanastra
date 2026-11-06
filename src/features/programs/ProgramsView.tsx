import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, InputNumber, Select, Table, Tag } from 'antd';
import { BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api, type ModuleData } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { Course } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { useDirectoryOptions } from '@/features/directories/useDirectoryOptions';
import { useCabinet } from '@/features/tenant/cabinet';
import { formatDate } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { PageHeader } from '@/pages/tenant/PageHeader';
import { ProgramFormModal } from './ProgramFormModal';

const totalHours = (c: Course) => (c.hoursTheory ?? 0) + (c.hoursPractice ?? 0);

/** Реестр учебных программ с фильтрами: название на 3 языках, формат, оценивание, трудоёмкость */
export function ProgramsView({ data }: { data: ModuleData }) {
  const { clientSlug, base } = useCabinet();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const access = user?.access ?? [];
  const canCreate = access.includes('lms_prog_core.create');
  const canEdit = access.includes('lms_prog_core.edit');
  const canDelete = access.includes('lms_prog_core.delete');
  const limitReached = data.create ? !data.create.available : false;

  const formats = useDirectoryOptions(clientSlug, 'course_format');
  const assessments = useDirectoryOptions(clientSlug, 'course_assessment');
  const nameOf = (list: { value: string; label: string }[] | undefined, id?: string | null) => list?.find((o) => o.value === id)?.label ?? '—';

  const [search, setSearch] = useState('');
  const [formatId, setFormatId] = useState<string>();
  const [assessmentId, setAssessmentId] = useState<string>();
  const [hoursFrom, setHoursFrom] = useState<number | null>(null);
  const [hoursTo, setHoursTo] = useState<number | null>(null);
  const [editing, setEditing] = useState<Course | 'new' | null>(null);

  const text = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      (data.courses ?? [])
        .filter((c) => !text || [c.titleKz, c.titleRu, c.titleEn].some((t) => t.toLowerCase().includes(text)))
        .filter((c) => !formatId || c.formatId === formatId)
        .filter((c) => !assessmentId || c.assessmentId === assessmentId)
        .filter((c) => hoursFrom === null || totalHours(c) >= hoursFrom)
        .filter((c) => hoursTo === null || totalHours(c) <= hoursTo),
    [data.courses, text, formatId, assessmentId, hoursFrom, hoursTo],
  );
  const filtered = Boolean(text || formatId || assessmentId) || hoursFrom !== null || hoursTo !== null;

  const remove = useMutation({
    mutationFn: (c: Course) => api.tenantAdmin(clientSlug).removeCourse(c.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tenantModuleData(clientSlug, 'COURSES') });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      message.success('Программа удалена');
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <div data-testid="programs-view">
      <PageHeader
        title="Учебные программы"
        subtitle={`Всего программ: ${data.courses?.length ?? 0}`}
        extra={
          canCreate && (
            <Button type="primary" icon={<Plus size={16} />} disabled={limitReached} onClick={() => setEditing('new')}>
              Создать программу
            </Button>
          )
        }
      />
      {limitReached && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          title="Достигнут лимит тарифа"
          description="Создание новых программ недоступно. Существующие программы сохранены."
        />
      )}
      <Card styles={{ body: { padding: 0 } }}>
        <div className="flex flex-wrap items-center gap-3 p-4" data-testid="programs-filters">
          <Input
            allowClear
            aria-label="Поиск программы"
            placeholder="Поиск по названию на любом языке"
            prefix={<Search size={14} className="text-muted" aria-hidden />}
            style={{ maxWidth: 320 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select aria-label="Фильтр по формату" allowClear placeholder="Формат курса" style={{ minWidth: 170 }} value={formatId} options={formats.data ?? []} onChange={setFormatId} />
          <Select aria-label="Фильтр по оцениванию" allowClear placeholder="Тип оценивания" style={{ minWidth: 170 }} value={assessmentId} options={assessments.data ?? []} onChange={setAssessmentId} />
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            Часы
            <InputNumber aria-label="Трудоёмкость от" placeholder="от" min={0} precision={0} style={{ width: 80 }} value={hoursFrom} onChange={(v) => setHoursFrom(v === null ? null : Number(v))} />
            <InputNumber aria-label="Трудоёмкость до" placeholder="до" min={0} precision={0} style={{ width: 80 }} value={hoursTo} onChange={(v) => setHoursTo(v === null ? null : Number(v))} />
          </span>
          {filtered && (
            <Button
              type="link"
              className="px-0"
              onClick={() => {
                setSearch('');
                setFormatId(undefined);
                setAssessmentId(undefined);
                setHoursFrom(null);
                setHoursTo(null);
              }}
            >
              Сбросить
            </Button>
          )}
          <span className="ml-auto text-sm text-muted" data-testid="programs-count">
            Показано: {visible.length} из {data.courses?.length ?? 0}
          </span>
        </div>
        <Table<Course>
          rowKey="id"
          dataSource={visible}
          pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ x: 900 }}
          locale={{ emptyText: filtered ? 'Ничего не найдено, измените фильтры' : 'Программ пока нет' }}
          columns={[
            {
              title: 'Обложка',
              key: 'cover',
              width: 96,
              render: (_, c) =>
                c.coverUrl ? (
                  <img src={c.coverUrl} alt="" className="h-12 w-16 rounded object-cover" />
                ) : (
                  <span className="flex h-12 w-16 items-center justify-center rounded bg-primary-soft text-primary">
                    <BookOpen size={18} aria-hidden />
                  </span>
                ),
            },
            {
              title: 'Название',
              key: 'title',
              render: (_, c) => (
                <div>
                  <Link to={`${base}/m/COURSES/${encodeURIComponent(c.id)}`} className="font-medium">
                    {c.titleRu}
                  </Link>
                  <div className="text-xs text-muted">{c.titleKz}</div>
                  {c.status === 'DRAFT' && <Tag className="mt-1">Черновик</Tag>}
                </div>
              ),
            },
            { title: 'Формат', key: 'format', width: 130, render: (_, c) => nameOf(formats.data, c.formatId) },
            { title: 'Тип оценивания', key: 'assessment', width: 140, render: (_, c) => nameOf(assessments.data, c.assessmentId) },
            {
              title: 'Трудоёмкость',
              key: 'hours',
              width: 130,
              render: (_, c) => (
                <span>
                  {totalHours(c)} ч
                  <span className="block text-xs text-muted">
                    теория {c.hoursTheory ?? 0} + практика {c.hoursPractice ?? 0}
                  </span>
                </span>
              ),
            },
            { title: 'Дата создания', key: 'createdAt', width: 130, render: (_, c) => formatDate(c.createdAt) },
            {
              title: '',
              key: 'actions',
              width: 96,
              render: (_, c) => (
                <span className="inline-flex gap-1">
                  {canEdit && <IconButton type="text" label={`Редактировать: ${c.titleRu}`} icon={<Pencil size={16} />} onClick={() => setEditing(c)} />}
                  {canDelete && (
                    <IconButton
                      type="text"
                      danger
                      label={`Удалить: ${c.titleRu}`}
                      icon={<Trash2 size={16} />}
                      onClick={() =>
                        modal.confirm({
                          title: `Удалить программу «${c.titleRu}»?`,
                          content: 'Будут удалены модули, дни и элементы контента. Группы останутся без программы.',
                          okText: 'Удалить',
                          cancelText: 'Отмена',
                          okButtonProps: { danger: true },
                          onOk: () => remove.mutate(c),
                        })
                      }
                    />
                  )}
                </span>
              ),
            },
          ]}
        />
      </Card>
      {editing && <ProgramFormModal clientSlug={clientSlug} course={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
