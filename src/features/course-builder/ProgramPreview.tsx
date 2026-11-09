import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Collapse, Empty, Modal, Segmented, Skeleton, Tag } from 'antd';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CourseElement, ElementType } from '@/api/types';
import { ProgramAbout } from '@/features/programs/ProgramAbout';
import { ErrorState } from '@/shared/PageState';
import { ElementIcon } from './ElementEditor';
import { ElementPreview } from './ElementPreview';
import { ELEMENT_LABEL } from './elementTypes';

export type PreviewRole = 'TRAINER' | 'LEARNER';

const ROLE_LABEL: Record<PreviewRole, string> = { TRAINER: 'Тренер', LEARNER: 'Слушатель' };
const ROLE_HINT: Record<PreviewRole, string> = {
  TRAINER: 'Так программу видит тренер: материалы для просмотра и элементы, которые он проверяет. Скрытые элементы не показываются.',
  LEARNER: 'Так программу видит слушатель: только опубликованные элементы, по клику — элемент глазами слушателя.',
};
/** Элементы, которые проверяет тренер */
const REVIEWED: ElementType[] = ['assignment', 'table'];

/** Просмотр программы глазами тренера или слушателя: содержимое с правами выбранной роли, без редактирования */
export function ProgramPreview({
  clientSlug,
  courseId,
  initialRole,
  onClose,
}: {
  clientSlug: string;
  courseId: string;
  initialRole: PreviewRole;
  onClose: () => void;
}) {
  const [role, setRole] = useState<PreviewRole>(initialRole);
  const [viewing, setViewing] = useState<CourseElement | null>(null);
  const q = useQuery({
    queryKey: [...queryKeys.courseContent(clientSlug, courseId), 'as', role],
    queryFn: () => api.courseBuilder(clientSlug, courseId).viewAs(role),
    retry: false,
  });

  const body = () => {
    if (q.isPending) return <Skeleton active paragraph={{ rows: 6 }} />;
    if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
    const { course, modules, demoElements = {} } = q.data;
    const total = modules.reduce((n, m) => n + m.days.reduce((k, d) => k + d.elements.length, 0), 0);
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h3 className="m-0 text-lg font-semibold">{course.title}</h3>
          <p className="m-0 text-sm text-muted">
            {modules.length} модулей · {total} элементов
          </p>
        </div>
        <Collapse items={[{ key: 'about', label: 'О программе', children: <ProgramAbout course={course} /> }]} />
        {!total && <Empty description="Для этой роли в программе пока нет доступных материалов" />}
        {modules.map((m, mi) => (
          <Card key={m.id} size="small" title={<span className="flex items-center gap-2"><Tag className="m-0">Модуль {mi + 1}</Tag>{m.title}</span>}>
            <div className="flex flex-col gap-3">
              {m.days.map((d) => (
                <section key={d.id} aria-label={d.title}>
                  <p className="m-0 mb-2 text-sm font-semibold">{d.title}</p>
                  {d.elements.length ? (
                    <ol className="m-0 flex list-none flex-col gap-2 p-0">
                      {d.elements.map((el) => {
                        const demo = el.type in demoElements;
                        return (
                          <li key={el.id}>
                            <button
                              type="button"
                              disabled={demo}
                              onClick={() => setViewing(el)}
                              className={`flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left ${demo ? 'cursor-not-allowed border-dashed opacity-70' : 'cursor-pointer hover:border-primary'}`}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                                <ElementIcon type={el.type} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{el.titleRu || el.titleKz}</span>
                                <span className="text-xs text-muted">{ELEMENT_LABEL[el.type]}</span>
                              </span>
                              <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                                {demo && (
                                  <Tag color="gold" className="m-0" icon={<Lock size={12} className="mr-1 inline" aria-hidden />}>
                                    Демо
                                  </Tag>
                                )}
                                {el.required && <Tag color="blue" className="m-0">Обязательный</Tag>}
                                {role === 'TRAINER' && REVIEWED.includes(el.type) && <Tag color="purple" className="m-0">Проверяет тренер</Tag>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="m-0 text-sm text-muted">Нет материалов</p>
                  )}
                </section>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Modal
      open
      width={900}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
      title={
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <span>Просмотр глазами</span>
          <Segmented
            aria-label="Роль для просмотра"
            value={role}
            onChange={(v) => setRole(v as PreviewRole)}
            options={(['TRAINER', 'LEARNER'] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </div>
      }
    >
      <div data-testid={`program-preview-${role}`}>
        <Alert className="mb-4" type="info" showIcon title={ROLE_HINT[role]} />
        {body()}
      </div>
      {viewing && <ElementPreview element={viewing} onClose={() => setViewing(null)} />}
    </Modal>
  );
}
