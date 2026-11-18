import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Image, Progress, Skeleton, Tag, Tree, Typography } from 'antd';
import { BookOpen, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CourseElement, LearnerCourseCard, LearnerCourseView } from '@/api/types';
import { courseElements, courseTree, ProfileFormView, progressText, ProgressTag, TestRunner, WorkForm } from '@/features/cabinet/CourseParts';
import { ElementContent } from '@/features/course-builder/ElementPreview';
import type { AssignmentSettings, ReflectionSettings } from '@/features/course-builder/elementTypes';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { useTenantContext } from '@/features/tenant/access';
import { formatDate } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { PageHeader } from './PageHeader';

const BUTTON_LABEL: Record<LearnerCourseCard['state'], string> = {
  NOT_STARTED: 'Начать курс',
  NEW: 'Начать курс',
  IN_PROGRESS: 'Продолжить курс',
  ARCHIVE: 'Обзор курса',
};

export function CourseCover({ title, coverUrl }: { title: string; coverUrl: string | null }) {
  return coverUrl ? (
    <Image height={190} preview={false} src={coverUrl} alt="" className="object-cover" />
  ) : (
    <div className="flex h-48 items-center justify-center bg-primary-soft" aria-label={title}>
      <BookOpen size={48} className="text-primary" aria-hidden />
    </div>
  );
}

export function LearnerCoursesPage() {
  const { clientSlug, base } = useTenantContext();
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const courses = useQuery({ queryKey: queryKeys.learnerCourses(clientSlug), queryFn: () => api.cabinet(clientSlug).learnerCourses() });

  const open = (card: LearnerCourseCard) => {
    if (card.state === 'NOT_STARTED') {
      modal.info({ title: 'Курс еще не начался', content: `Курс еще не начался. Пожалуйста, ожидайте даты начала ${formatDate(card.startDate)}` });
      return;
    }
    if (card.state !== 'ARCHIVE' && card.missingProfileFields > 0) {
      modal.confirm({
        title: 'Заполните анкету',
        content: `Заполните еще ${card.missingProfileFields} полей анкеты группы для доступа к обучению.`,
        okText: 'Перейти в профиль',
        cancelText: 'Отмена',
        onOk: () => navigate(`${base}/profile`),
      });
      return;
    }
    navigate(`${base}/courses/${card.groupId}`);
  };

  return (
    <>
      <PageHeader title="Мои курсы" />
      {courses.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
      ) : !courses.data.length ? (
        <Card>
          <Empty description="Вы пока не зачислены ни в одну группу" />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {courses.data.map((card) => (
            <Card key={card.groupId} cover={<CourseCover title={card.courseTitle} coverUrl={card.coverUrl} />}>
              <Typography.Title level={4}>{card.courseTitle}</Typography.Title>
              <div className="mb-4 flex flex-col gap-0.5">
                <span>Период: {formatDate(card.startDate)} — {formatDate(card.endDate)}</span>
                <span>Тренер: {card.trainerNames.join(', ') || '—'}</span>
                <span>Формат: {card.formatName ?? '—'}</span>
              </div>
              {card.state === 'ARCHIVE' && <Tag className="mb-3">Архивная группа</Tag>}
              {card.state !== 'ARCHIVE' && card.missingProfileFields > 0 && (
                <Alert className="mb-3" type="warning" showIcon title={`Анкета: не заполнено обязательных полей — ${card.missingProfileFields}`} />
              )}
              <Progress percent={card.percent} />
              <Button type="primary" icon={<Play size={16} aria-hidden />} onClick={() => open(card)}>
                {BUTTON_LABEL[card.state]}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

export function LearnerProfilePage() {
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
        ) : form.data.sections.some((s) => s.fields.length) ? (
          <ProfileFormView form={form.data} clientSlug={clientSlug} />
        ) : (
          <Card>
            <Empty description="Анкеты учебных групп не требуют дополнительных данных" />
          </Card>
        )}
      </div>
    </>
  );
}

function WorkTask({ element }: { element: CourseElement }) {
  if (element.type === 'assignment') {
    const s = element.settings as unknown as AssignmentSettings;
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-sm font-medium">Задание</p>
        <p className="m-0 whitespace-pre-line">{s.task_ru || '—'}</p>
        {s.criteria_ru && <p className="m-0 text-sm text-muted whitespace-pre-line">Критерии оценки: {s.criteria_ru}</p>}
      </div>
    );
  }
  const s = element.settings as unknown as ReflectionSettings;
  return <p className="m-0 font-medium whitespace-pre-line">{s.question_ru || '—'}</p>;
}

function LearnerElement({ view, element, clientSlug }: { view: LearnerCourseView; element: CourseElement; clientSlug: string }) {
  const qc = useQueryClient();
  const cabinet = api.cabinet(clientSlug);
  const key = queryKeys.learnerCourse(clientSlug, view.groupId);
  const progress = view.progress[element.id]!;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: queryKeys.learnerCourses(clientSlug) });
  };

  if (element.type === 'test') {
    if (progress.status === 'TEST_PASSED')
      return (
        <Alert type="success" showIcon title={progressText(progress)} description="Тест сдан. Результат сохранён в журнале группы." />
      );
    return (
      <TestRunner
        key={element.id}
        element={element}
        disabled={view.readonly}
        onSubmit={async (answers) => {
          const result = await cabinet.submitTest(view.groupId, element.id, answers);
          refresh();
          return result;
        }}
      />
    );
  }
  if (element.type === 'assignment' || element.type === 'reflection')
    return (
      <div className="flex flex-col gap-4">
        <WorkTask element={element} />
        <WorkForm
          key={element.id}
          progress={progress}
          disabled={view.readonly}
          onSubmit={async (answer) => {
            qc.setQueryData(key, await cabinet.submitWork(view.groupId, element.id, answer));
            void qc.invalidateQueries({ queryKey: queryKeys.learnerCourses(clientSlug) });
          }}
        />
      </div>
    );
  return <ElementContent element={element} />;
}

export function LearnerCoursePage() {
  const { groupId = '' } = useParams();
  const { clientSlug } = useTenantContext();
  const qc = useQueryClient();
  const key = queryKeys.learnerCourse(clientSlug, groupId);
  const course = useQuery({ queryKey: key, queryFn: () => api.cabinet(clientSlug).learnerCourse(groupId), retry: false });
  const [selectedId, setSelectedId] = useState('');
  const view = useMutation({
    mutationFn: (elementId: string) => api.cabinet(clientSlug).viewElement(groupId, elementId),
    onSuccess: (data) => {
      qc.setQueryData(key, data);
      void qc.invalidateQueries({ queryKey: queryKeys.learnerCourses(clientSlug) });
    },
  });

  const data = course.data;
  const elements = data ? courseElements(data.modules) : [];
  const selected =
    elements.find((e) => e.id === selectedId) ??
    elements.find((e) => !['VIEWED', 'TEST_PASSED', 'WORK_ON_REVIEW', 'WORK_DONE'].includes(data!.progress[e.id]?.status ?? '')) ??
    elements[0];
  const status = selected && data ? data.progress[selected.id]?.status : undefined;
  // Открытие материала отмечает его просмотренным, теста — начатым. В архиве прогресс не меняется.
  const shouldMark = Boolean(data && !data.readonly && selected && (status === 'NOT_VIEWED' || (status === 'TEST_NOT_PASSED' && data.progress[selected.id]?.score === null)));
  const { mutate, isPending } = view;
  useEffect(() => {
    if (shouldMark && selected && !isPending) mutate(selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- отметка один раз при открытии элемента
  }, [shouldMark, selected?.id]);

  if (course.isPending) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (course.isError) return <ErrorState title="Курс недоступен" error={course.error} onRetry={() => void course.refetch()} />;

  return (
    <>
      <PageHeader title={data!.course.title} />
      <div className="mb-5 flex flex-col gap-1">
        <span className="text-sm text-muted">
          {data!.groupName} · {formatDate(data!.startDate)} — {formatDate(data!.endDate)}
        </span>
        <Progress percent={data!.percent} aria-label="Прогресс прохождения курса" />
      </div>
      {data!.readonly && <Alert className="mb-5" type="info" showIcon title="Курс находится в архиве. Доступен только обзор материалов без повторного прохождения тестов и заданий." />}
      {!elements.length ? (
        <Card>
          <Empty description="В курсе пока нет материалов" />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <Card title="Содержание">
            <Tree
              defaultExpandAll
              treeData={courseTree(data!.modules, (e) => progressText(data!.progress[e.id]!))}
              selectedKeys={selected ? [selected.id] : []}
              onSelect={(keys) => {
                const element = elements.find((e) => e.id === keys[0]);
                if (element) setSelectedId(element.id);
              }}
            />
          </Card>
          <Card title={selected?.titleRu} extra={selected && <ProgressTag progress={data!.progress[selected.id]!} />}>
            {selected && <LearnerElement key={selected.id} view={data!} element={selected} clientSlug={clientSlug} />}
          </Card>
        </div>
      )}
    </>
  );
}
