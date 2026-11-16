import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Input, Modal, Skeleton, Tag, Typography } from 'antd';
import { ArrowLeft, CalendarDays, Clock, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { ShowcaseApplicationPayload, ShowcaseCourse, ShowcaseGroup } from '@/api/types';
import { formatPhone } from '@/features/auth/validation';
import { formatDate } from '@/shared/format';
import { Field } from '@/shared/FormField';
import { ErrorState } from '@/shared/PageState';

function ApplicationModal({ course, group, onClose }: { course: ShowcaseCourse; group: ShowcaseGroup; onClose: () => void }) {
  const { message } = App.useApp();
  const [values, setValues] = useState<ShowcaseApplicationPayload>({ fullName: '', email: '', phone: '' });
  const submit = useMutation({
    mutationFn: () => api.showcase.apply(course.clientSlug, group.id, values),
    onSuccess: () => {
      message.success('Заявка отправлена');
      onClose();
    },
  });
  const errors = isApiError(submit.error) ? submit.error.fieldErrors : {};
  const set = (patch: Partial<ShowcaseApplicationPayload>) => {
    setValues((current) => ({ ...current, ...patch }));
    submit.reset();
  };

  return (
    <Modal
      open
      title={`Оставить заявку: ${group.name}`}
      okText="Отправить"
      cancelText="Отмена"
      confirmLoading={submit.isPending}
      onOk={() => submit.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <form className="flex flex-col gap-4 pt-2" aria-label="Заявка с витрины" onSubmit={(event) => { event.preventDefault(); submit.mutate(); }}>
        <Field label="ФИО" htmlFor="showcase-full-name" required error={errors.fullName}>
          <Input id="showcase-full-name" autoFocus value={values.fullName} onChange={(event) => set({ fullName: event.target.value })} />
        </Field>
        <Field label="Email" htmlFor="showcase-email" required error={errors.email}>
          <Input id="showcase-email" type="email" value={values.email} onChange={(event) => set({ email: event.target.value })} />
        </Field>
        <Field label="Номер телефона" htmlFor="showcase-phone" required error={errors.phone}>
          <Input id="showcase-phone" type="tel" placeholder="+7 (7XX) XXX-XX-XX" value={values.phone} onChange={(event) => set({ phone: formatPhone(event.target.value) })} />
        </Field>
        {submit.isError && !Object.keys(errors).length && <Alert type="error" showIcon title={submit.error.message} />}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function GroupList({ course }: { course: ShowcaseCourse }) {
  const [selected, setSelected] = useState<ShowcaseGroup | null>(null);
  return (
    <>
      <div className="flex flex-col gap-3">
        {course.groups.map((group) => (
          <div key={group.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div>
              <div className="font-semibold">{group.name}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {formatDate(group.startDate)} – {formatDate(group.endDate)}</span>
                {group.trainerNames.length > 0 && <span className="inline-flex items-center gap-1"><UserRound size={14} /> {group.trainerNames.join(', ')}</span>}
              </div>
            </div>
            <Button type="primary" disabled={group.placesLeft === 0} onClick={() => setSelected(group)}>
              Оставить заявку
            </Button>
          </div>
        ))}
      </div>
      {selected && <ApplicationModal course={course} group={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function CourseCard({ course }: { course: ShowcaseCourse }) {
  const [selected, setSelected] = useState<ShowcaseGroup | null>(null);
  return (
    <>
      <Card
        cover={course.coverUrl ? <img src={course.coverUrl} alt="" className="h-48 object-cover" /> : <div className="flex h-48 items-center justify-center bg-primary-soft text-lg font-semibold text-primary">{course.title}</div>}
      >
        <Link to={`/${course.clientSlug}/learn/${course.id}`} className="text-lg font-semibold text-text no-underline hover:text-primary">
          {course.title}
        </Link>
        <div className="mt-2 flex flex-wrap gap-2">
          {course.formatName && <Tag>{course.formatName}</Tag>}
          <Tag icon={<Clock size={12} />}>{(course.hoursTheory ?? 0) + (course.hoursPractice ?? 0)} ч.</Tag>
        </div>
        <p className="mt-3 mb-1 line-clamp-3 text-sm text-muted">{course.description}</p>
        <p className="m-0 text-sm">Тренер: {course.teacher}</p>
        <p className="mt-3 mb-2 text-sm font-medium">Открытые группы</p>
        <div className="flex flex-col gap-2">
          {course.groups.map((group) => (
            <div key={group.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm">
              <span>{group.name}</span>
              <Button size="small" disabled={group.placesLeft === 0} onClick={() => setSelected(group)}>Оставить заявку</Button>
            </div>
          ))}
        </div>
      </Card>
      {selected && <ApplicationModal course={course} group={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export function ShowcasePage() {
  const { clientSlug = '', courseId } = useParams();
  const list = useQuery({ queryKey: queryKeys.showcase(clientSlug), queryFn: () => api.showcase.list(clientSlug), enabled: !courseId });
  const detail = useQuery({
    queryKey: queryKeys.showcaseCourse(clientSlug, courseId ?? ''),
    queryFn: () => api.showcase.get(clientSlug, courseId ?? ''),
    enabled: Boolean(courseId),
  });
  const query = courseId ? detail : list;

  if (query.isPending) return <div className="mx-auto max-w-6xl p-8"><Skeleton active paragraph={{ rows: 8 }} /></div>;
  if (query.isError) return <div className="mx-auto max-w-6xl p-8"><ErrorState error={query.error} onRetry={() => void query.refetch()} /></div>;

  if (courseId) {
    const course = detail.data!;
    return (
      <main className="min-h-screen bg-page">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
          <Link to={`/${clientSlug}/learn`} className="inline-flex items-center gap-2 self-start"><ArrowLeft size={16} /> К каталогу</Link>
          {course.coverUrl && <img src={course.coverUrl} alt="" className="max-h-96 w-full rounded-xl object-cover" />}
          <div>
            <Typography.Title level={1}>{course.title}</Typography.Title>
            <div className="flex flex-wrap gap-2">
              {course.formatName && <Tag>{course.formatName}</Tag>}
              <Tag>Теория: {course.hoursTheory ?? 0} ч.</Tag>
              <Tag>Практика: {course.hoursPractice ?? 0} ч.</Tag>
            </div>
          </div>
          <Typography.Paragraph>{course.description}</Typography.Paragraph>
          <p className="m-0">Тренер: {course.teacher}</p>
          <section>
            <Typography.Title level={3}>Открытые группы</Typography.Title>
            <GroupList course={course} />
          </section>
        </div>
      </main>
    );
  }

  const courses = list.data ?? [];
  return (
    <main className="min-h-screen bg-page">
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Typography.Title level={1} style={{ margin: 0 }}>{courses[0]?.organizationName ?? 'Витрина курсов'}</Typography.Title>
          <Typography.Text type="secondary">Опубликованные программы и открытые группы</Typography.Text>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">
        {courses.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{courses.map((course) => <CourseCard key={course.id} course={course} />)}</div> : <Empty description="Открытых групп пока нет" />}
      </div>
    </main>
  );
}
