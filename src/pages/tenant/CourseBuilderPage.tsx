import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Collapse, Dropdown, Empty, Input, Skeleton, Tag, Tooltip } from 'antd';
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, Eye, Lock, MoreHorizontal, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CourseContent, CourseDay, CourseElement, CourseModule, ElementAction, ElementType } from '@/api/types';
import { useCabinet } from '@/features/tenant/cabinet';
import { AddElementModal, ElementEditor, ElementIcon } from '@/features/course-builder/ElementEditor';
import { ElementPreview } from '@/features/course-builder/ElementPreview';
import { ELEMENT_HINT, ELEMENT_LABEL, ELEMENT_TYPES, readinessIssues } from '@/features/course-builder/elementTypes';
import { ProgramFormModal } from '@/features/programs/ProgramFormModal';
import { sanitizeRichText } from '@/shared/richText';
import { FeatureGuard } from '@/features/tenant/access';
import { UpgradePromoModal, useModuleCatalog } from '@/features/tenant-admin/UpgradePromo';
import { ADVANCED_CONTENT_MODULE } from '@/shared/access';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { PageHeader } from './PageHeader';

/** Название, которое можно переименовать по месту */
function EditableTitle({
  value,
  label,
  editable,
  onSave,
  className,
}: {
  value: string;
  label: string;
  editable: boolean;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  if (!editing)
    return (
      <span className={`inline-flex min-w-0 items-center gap-1 ${className ?? ''}`}>
        <span className="truncate">{value}</span>
        {editable && (
          <IconButton
            type="text"
            size="small"
            label={`Переименовать: ${value}`}
            icon={<Pencil size={14} />}
            onClick={() => {
              setText(value);
              setEditing(true);
            }}
          />
        )}
      </span>
    );
  const commit = () => {
    setEditing(false);
    if (text.trim() && text.trim() !== value) onSave(text.trim());
  };
  return (
    <Input
      autoFocus
      size="small"
      aria-label={label}
      maxLength={255}
      value={text}
      style={{ maxWidth: 360 }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

const demoText = (tariff: string | null | undefined) => (tariff ? `Демо / Доступно в тарифе ${tariff}` : 'Демо');

function DemoTag({ tariff }: { tariff: string | null | undefined }) {
  return (
    <Tag color="gold" className="m-0" icon={<Lock size={12} className="mr-1 inline" aria-hidden />}>
      {demoText(tariff)}
    </Tag>
  );
}

/** Элемент типа вне тарифа: только карточка, клик открывает демо-доступ */
function DemoElementRow({ el, tariff, onOpen }: { el: CourseElement; tariff: string | null | undefined; onOpen: () => void }) {
  const title = el.titleRu || el.titleKz;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-3 py-2 opacity-80" data-testid={`element-${el.id}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-muted">
        <ElementIcon type={el.type} />
      </span>
      <button type="button" className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        <span className="block truncate text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-muted">{ELEMENT_LABEL[el.type]}</span>
      </button>
      <DemoTag tariff={tariff} />
    </li>
  );
}

function ElementRow({
  el,
  index,
  total,
  canEdit,
  canChange,
  canDelete,
  onOpen,
  onEdit,
  onMove,
  onRemove,
}: {
  el: CourseElement;
  index: number;
  total: number;
  canEdit: boolean;
  /** Право «Редактирование» для типа элемента */
  canChange: boolean;
  /** Право «Удаление» для типа элемента */
  canDelete: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onMove: (d: 'up' | 'down') => void;
  onRemove: () => void;
}) {
  const issues = canEdit ? readinessIssues(el) : [];
  const title = el.titleRu || el.titleKz;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2" data-testid={`element-${el.id}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <ElementIcon type={el.type} />
      </span>
      <button type="button" className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent p-0 text-left" onClick={onOpen}>
        <span className="block truncate text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-muted">
          {ELEMENT_LABEL[el.type]}
          {canEdit && !el.titleKz && ' · нет названия KZ'}
        </span>
      </button>
      <span className="hidden flex-wrap gap-1 sm:flex">
        {el.required && <Tag color="blue">Обязательный</Tag>}
        {el.hidden && <Tag>Скрыт</Tag>}
        {issues.length > 0 && (
          <Tooltip title={issues.join(' · ')}>
            <Tag color="warning" icon={<TriangleAlert size={12} className="mr-1 inline" aria-hidden />}>
              Не заполнен
            </Tag>
          </Tooltip>
        )}
      </span>
      <IconButton type="text" label={`Просмотр «${title}»`} icon={<Eye size={16} />} onClick={onOpen} />
      {canChange && <IconButton type="text" label={`Настроить «${title}»`} icon={<Pencil size={16} />} onClick={onEdit} />}
      {(canEdit || canDelete) && (
        <>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'up', label: 'Выше', icon: <ArrowUp size={14} />, disabled: !canEdit || index === 0 },
                { key: 'down', label: 'Ниже', icon: <ArrowDown size={14} />, disabled: !canEdit || index === total - 1 },
                { type: 'divider' },
                { key: 'remove', label: 'Удалить', icon: <Trash2 size={14} />, danger: true, disabled: !canDelete },
              ],
              onClick: ({ key }) => (key === 'remove' ? onRemove() : onMove(key as 'up' | 'down')),
            }}
          >
            <IconButton type="text" label={`Действия с элементом «${title}»`} icon={<MoreHorizontal size={16} />} />
          </Dropdown>
        </>
      )}
    </li>
  );
}

function CourseBuilder({ courseId }: { courseId: string }) {
  const { clientSlug, base } = useCabinet();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const key = queryKeys.courseContent(clientSlug, courseId);
  const builder = api.courseBuilder(clientSlug, courseId);
  const q = useQuery({ queryKey: key, queryFn: builder.get, retry: false });

  const [adding, setAdding] = useState<{ dayId: string; type: ElementType } | null>(null);
  const [promo, setPromo] = useState(false);
  const catalog = useModuleCatalog(clientSlug, true);
  const promoModule = catalog.data?.find((m) => m.code === ADVANCED_CONTENT_MODULE);
  const [editing, setEditing] = useState<CourseElement | null>(null);
  const [viewing, setViewing] = useState<CourseElement | null>(null);
  const [editingProgram, setEditingProgram] = useState(false);
  const navigate = useNavigate();
  const admin = api.tenantAdmin(clientSlug);
  const removeCourse = useMutation({
    mutationFn: () => admin.removeCourse(courseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tenantModuleData(clientSlug, 'COURSES') });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      message.success('Программа удалена');
      navigate(`${base}/m/COURSES`, { replace: true });
    },
    onError: (e) => message.error(e.message),
  });

  const change = useMutation({
    mutationFn: (fn: () => Promise<CourseContent>) => fn(),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      void qc.invalidateQueries({ queryKey: queryKeys.tenantModuleData(clientSlug, 'COURSES') });
    },
    onError: (e) => message.error(e.message),
  });
  const run = (fn: () => Promise<CourseContent>, done?: string) =>
    change.mutate(fn, { onSuccess: () => done && message.success(done) });

  const confirmRemove = (title: string, text: string, fn: () => Promise<CourseContent>, done: string) =>
    modal.confirm({
      title: `Удалить «${title}»?`,
      content: text,
      okText: 'Удалить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => run(fn, done),
    });

  if (q.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  const { course, canEdit, canDeleteCourse, modules, elementAccess, demoElements = {} } = q.data;
  // Итоговый доступ роли к элементам контента: какие типы можно создавать, править, удалять
  const allowed = (type: ElementType, action: ElementAction) => elementAccess[type]?.includes(action) ?? false;
  const creatable = ELEMENT_TYPES.filter((t) => allowed(t, 'create'));
  // Типы вне тарифа: в списке добавления подсвечены как демо
  const isDemo = (type: ElementType) => type in demoElements;
  const demoTypes = ELEMENT_TYPES.filter(isDemo);
  const openDemo = () => (promoModule ? setPromo(true) : message.info('Элемент доступен в демо-режиме: он не входит в тариф организации'));
  const total = modules.reduce((n, m) => n + m.days.reduce((k, d) => k + d.elements.length, 0), 0);

  const renderDay = (m: CourseModule, d: CourseDay, di: number) => (
    <section key={d.id} className="rounded-xl bg-subtle p-3" data-testid={`day-${d.id}`} aria-label={d.title}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <EditableTitle
          value={d.title}
          label="Название дня"
          editable={canEdit}
          className="font-semibold"
          onSave={(t) => run(() => builder.renameDay(d.id, t))}
        />
        <span className="flex items-center gap-1">
          <span className="text-xs text-muted">
            День {di + 1} из {m.days.length}
          </span>
          {canEdit && (
            <IconButton
              type="text"
              danger
              size="small"
              label={`Удалить день «${d.title}»`}
              icon={<Trash2 size={14} />}
              onClick={() =>
                confirmRemove(d.title, 'День и все его элементы будут удалены из курса.', () => builder.removeDay(d.id), 'День удалён')
              }
            />
          )}
        </span>
      </div>
      {d.elements.length ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {d.elements.map((el, i) =>
            isDemo(el.type) ? (
              <DemoElementRow key={el.id} el={el} tariff={demoElements[el.type]} onOpen={openDemo} />
            ) : (
              <ElementRow
                key={el.id}
                el={el}
                index={i}
                total={d.elements.length}
                canEdit={canEdit}
                canChange={allowed(el.type, 'edit')}
                canDelete={allowed(el.type, 'delete')}
                onOpen={() => setViewing(el)}
                onEdit={() => setEditing(el)}
                onMove={(dir) => run(() => builder.moveElement(el.id, dir))}
                onRemove={() =>
                  confirmRemove(
                    el.titleRu || el.titleKz,
                    'Элемент пропадёт из курса вместе с настройками и файлами.',
                    () => builder.removeElement(el.id),
                    'Элемент удалён',
                  )
                }
              />
            ),
          )}
        </ol>
      ) : (
        <p className="m-0 py-2 text-sm text-muted">В этом дне пока нет элементов.</p>
      )}
      {canEdit && creatable.length + demoTypes.length > 0 && (
        <Dropdown
          trigger={['click']}
          menu={{
            className: 'max-h-96 overflow-y-auto',
            items: [
              ...creatable.map((t) => ({
                key: t,
                icon: <ElementIcon type={t} />,
                label: (
                  <span className="flex flex-col">
                    <span>{ELEMENT_LABEL[t]}</span>
                    <span className="text-xs text-muted">{ELEMENT_HINT[t]}</span>
                  </span>
                ),
              })),
              ...(demoTypes.length ? [{ type: 'divider' as const }] : []),
              ...demoTypes.map((t) => ({
                key: `demo:${t}`,
                icon: <ElementIcon type={t} />,
                label: (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{ELEMENT_LABEL[t]}</span>
                    <DemoTag tariff={demoElements[t]} />
                  </span>
                ),
              })),
            ],
            onClick: ({ key }) => (key.startsWith('demo:') ? openDemo() : setAdding({ dayId: d.id, type: key as ElementType })),
          }}
        >
          <Button className="mt-2" type="dashed" block icon={<Plus size={16} />} data-testid={`add-element-${d.id}`}>
            Добавить элемент контента <ChevronDown size={14} className="ml-1 inline" aria-hidden />
          </Button>
        </Dropdown>
      )}
    </section>
  );

  return (
    <div data-testid="course-builder">
      <div className="mb-2">
        <Link to={`${base}/m/COURSES`} className="inline-flex items-center gap-1 text-sm">
          <ArrowLeft size={14} aria-hidden /> Все курсы
        </Link>
      </div>
      <PageHeader
        title={course.title}
        subtitle={
          canEdit
            ? `Содержимое курса · ${modules.length} модулей · ${total} элементов. Изменения сохраняются сразу.`
            : `${modules.length} модулей · ${total} элементов`
        }
        extra={
          <>
            {canEdit && (
              <Button icon={<Pencil size={16} />} onClick={() => setEditingProgram(true)}>
                Редактировать программу
              </Button>
            )}
            {canDeleteCourse && (
              <Button
                danger
                icon={<Trash2 size={16} />}
                onClick={() =>
                  modal.confirm({
                    title: `Удалить программу «${course.title}»?`,
                    content: 'Будут удалены модули, дни и элементы контента. Группы останутся без программы.',
                    okText: 'Удалить',
                    cancelText: 'Отмена',
                    okButtonProps: { danger: true },
                    onOk: () => removeCourse.mutate(),
                  })
                }
              >
                Удалить
              </Button>
            )}
            {canEdit && (
              <Button type="primary" icon={<Plus size={16} />} loading={change.isPending} onClick={() => run(() => builder.addModule(''), 'Модуль добавлен')}>
                Добавить модуль
              </Button>
            )}
          </>
        }
      />

      <Collapse
        className="mb-4"
        data-testid="program-info"
        items={[
          {
            key: 'about',
            label: 'О программе',
            children: (
              <div className="flex flex-col gap-3 text-sm">
                <div className="rich-text" dangerouslySetInnerHTML={{ __html: sanitizeRichText(course.descriptionRu) }} />
                {course.goalRu && (
                  <p className="m-0 whitespace-pre-line">
                    <span className="font-medium">Цель: </span>
                    {course.goalRu}
                  </p>
                )}
                {course.resultRu && (
                  <p className="m-0 whitespace-pre-line">
                    <span className="font-medium">Ожидаемый результат: </span>
                    {course.resultRu}
                  </p>
                )}
                <p className="m-0 text-muted">
                  Теория: {course.hoursTheory ?? 0} ч · практика: {course.hoursPractice ?? 0} ч
                </p>
              </div>
            ),
          },
        ]}
      />

      {!modules.length && (
        <Card>
          <Empty description={canEdit ? 'Структура курса пуста — добавьте первый модуль' : 'Содержимое курса ещё не готово'} />
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {modules.map((m, mi) => (
          <Card
            key={m.id}
            data-testid={`module-${m.id}`}
            title={
              <span className="flex min-w-0 items-center gap-2">
                <Tag className="m-0">Модуль {mi + 1}</Tag>
                <EditableTitle value={m.title} label="Название модуля" editable={canEdit} onSave={(t) => run(() => builder.renameModule(m.id, t))} />
              </span>
            }
            extra={
              canEdit && (
                <span className="flex items-center gap-1">
                  <IconButton type="text" size="small" label="Модуль выше" icon={<ArrowUp size={14} />} disabled={mi === 0} onClick={() => run(() => builder.moveModule(m.id, 'up'))} />
                  <IconButton
                    type="text"
                    size="small"
                    label="Модуль ниже"
                    icon={<ArrowDown size={14} />}
                    disabled={mi === modules.length - 1}
                    onClick={() => run(() => builder.moveModule(m.id, 'down'))}
                  />
                  <IconButton
                    type="text"
                    danger
                    size="small"
                    label={`Удалить модуль «${m.title}»`}
                    icon={<Trash2 size={14} />}
                    onClick={() =>
                      confirmRemove(m.title, 'Модуль, его дни и элементы будут удалены из курса.', () => builder.removeModule(m.id), 'Модуль удалён')
                    }
                  />
                </span>
              )
            }
          >
            <div className="flex flex-col gap-3">
              {m.days.map((d, di) => renderDay(m, d, di))}
              {canEdit && (
                <div>
                  <Button icon={<Plus size={16} />} onClick={() => run(() => builder.addDay(m.id, ''), 'День добавлен')}>
                    Добавить день
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {adding && (
        <AddElementModal
          clientSlug={clientSlug}
          courseId={courseId}
          dayId={adding.dayId}
          initialType={adding.type}
          types={creatable}
          onClose={() => setAdding(null)}
          onCreated={(el) => {
            setAdding(null);
            setEditing(el);
          }}
        />
      )}
      {editing && <ElementEditor key={editing.id} clientSlug={clientSlug} courseId={courseId} element={editing} onClose={() => setEditing(null)} />}
      {viewing && <ElementPreview element={viewing} onClose={() => setViewing(null)} />}
      {promo && promoModule && <UpgradePromoModal module={promoModule} onClose={() => setPromo(false)} />}
      {editingProgram && <ProgramFormModal clientSlug={clientSlug} course={course} onClose={() => setEditingProgram(false)} />}
    </div>
  );
}

/** Страница курса: конструктор содержимого (модули → дни → элементы контента) */
export function CourseBuilderPage() {
  const { courseId = '' } = useParams();
  return (
    <FeatureGuard code="COURSES">
      <CourseBuilder courseId={courseId} />
    </FeatureGuard>
  );
}
