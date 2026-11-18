import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Checkbox, Input, InputNumber, Radio, Result, Select, Tabs, Tag } from 'antd';
import { useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CourseElement, CourseModule, ElementProgress, ProfileForm, ProfileFormSection, TestAnswers, TestResult } from '@/api/types';
import type { TestSettings } from '@/features/course-builder/elementTypes';

// ---------- Статусы элементов ----------

const STATUS_TEXT: Record<ElementProgress['status'], string> = {
  NOT_VIEWED: 'Не просмотрено',
  VIEWED: 'Просмотрено',
  TEST_NOT_PASSED: 'Не сдан',
  TEST_IN_PROGRESS: 'В процессе',
  TEST_PASSED: 'Сдан',
  WORK_NOT_STARTED: 'Не приступал',
  WORK_ON_REVIEW: 'На проверке',
  WORK_DONE: 'Выполнено',
};

const STATUS_COLOR: Partial<Record<ElementProgress['status'], string>> = {
  VIEWED: 'green',
  TEST_PASSED: 'green',
  WORK_DONE: 'green',
  TEST_IN_PROGRESS: 'blue',
  WORK_ON_REVIEW: 'gold',
};

export function progressText(p: ElementProgress) {
  const text = STATUS_TEXT[p.status];
  if ((p.status === 'TEST_PASSED' || p.status === 'TEST_NOT_PASSED') && p.score !== null) return `${text}: ${p.score} из ${p.maxScore} б.`;
  return text;
}

export function ProgressTag({ progress }: { progress: ElementProgress }) {
  return <Tag color={STATUS_COLOR[progress.status]}>{progressText(progress)}</Tag>;
}

// ---------- Структура курса ----------

export const courseElements = (modules: CourseModule[]) => modules.flatMap((m) => m.days.flatMap((d) => d.elements));

export const courseTree = (modules: CourseModule[], mark?: (element: CourseElement) => string) =>
  modules.map((m) => ({
    key: m.id,
    title: m.title,
    selectable: false,
    children: m.days.map((d) => ({
      key: d.id,
      title: d.title,
      selectable: false,
      children: d.elements.map((e) => ({ key: e.id, title: mark ? `${e.titleRu} · ${mark(e)}` : e.titleRu, isLeaf: true })),
    })),
  }));

// ---------- Тест ----------

const AUTO_TYPES = ['single', 'multiple', 'numeric', 'short'];

/**
 * Прохождение теста. Автоматически проверяются вопросы с выбором ответа, числом и коротким ответом;
 * остальные типы вопросов проверяет тренер. Результат считает сервер.
 */
export function TestRunner({
  element,
  disabled,
  dryRun,
  onSubmit,
}: {
  element: CourseElement;
  disabled?: boolean;
  dryRun?: boolean;
  onSubmit: (answers: TestAnswers) => Promise<TestResult>;
}) {
  const s = element.settings as unknown as TestSettings;
  const [answers, setAnswers] = useState<TestAnswers>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const submit = useMutation({ mutationFn: () => onSubmit(answers), onSuccess: setResult });
  const set = (id: string, value: string | string[]) => setAnswers((current) => ({ ...current, [id]: value }));
  const questions = s.questions ?? [];

  if (result)
    return (
      <Result
        status={result.passed ? 'success' : 'warning'}
        title={result.passed ? 'Тест сдан' : 'Тест не сдан'}
        subTitle={
          <>
            Балл: {result.score} из {result.maxScore} ({result.percent}%), проходной {s.pass_percent}%.
            {result.manualQuestions > 0 && ` Вопросов на проверке у тренера: ${result.manualQuestions}.`}
            {result.dryRun && ' Режим симуляции: результат не сохранён.'}
          </>
        }
        extra={dryRun || !result.passed ? <Button onClick={() => { setResult(null); setAnswers({}); }}>Пройти ещё раз</Button> : undefined}
      />
    );

  return (
    <form
      className="flex flex-col gap-4"
      aria-label={`Тест: ${element.titleRu}`}
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <p className="m-0 text-sm text-muted">
        Вопросов: {questions.length} · проходной балл {s.pass_percent}% · попыток: {s.attempts ?? 'без ограничений'}
      </p>
      {questions.map((q, index) => (
        <fieldset key={q.id} className="m-0 rounded-lg border border-border p-4">
          <legend className="px-1 text-xs text-muted">Вопрос {index + 1}</legend>
          <p className="m-0 mb-3 font-medium whitespace-pre-line">{q.text_ru || q.gaps_ru}</p>
          {q.type === 'single' && (
            <Radio.Group
              className="flex flex-col gap-1"
              disabled={disabled}
              value={answers[q.id]}
              onChange={(event) => set(q.id, event.target.value as string)}
              options={q.options.map((o) => ({ value: o.id, label: o.ru }))}
            />
          )}
          {q.type === 'multiple' && (
            <Checkbox.Group
              className="flex flex-col gap-1"
              disabled={disabled}
              value={(answers[q.id] as string[] | undefined) ?? []}
              onChange={(value) => set(q.id, value as string[])}
              options={q.options.map((o) => ({ value: o.id, label: o.ru }))}
            />
          )}
          {q.type === 'numeric' && (
            <InputNumber
              aria-label={`Ответ на вопрос ${index + 1}`}
              disabled={disabled}
              value={answers[q.id] === undefined ? null : Number(answers[q.id])}
              onChange={(value) => set(q.id, value === null ? '' : String(value))}
            />
          )}
          {q.type === 'short' && (
            <Input
              aria-label={`Ответ на вопрос ${index + 1}`}
              disabled={disabled}
              value={(answers[q.id] as string | undefined) ?? ''}
              onChange={(event) => set(q.id, event.target.value)}
            />
          )}
          {!AUTO_TYPES.includes(q.type) && <p className="m-0 text-xs text-muted">Этот вопрос проверяет тренер.</p>}
        </fieldset>
      ))}
      {submit.isError && <Alert type="error" showIcon title={submit.error.message} />}
      <div>
        <Button type="primary" htmlType="submit" disabled={disabled || !questions.length} loading={submit.isPending}>
          Завершить тест
        </Button>
      </div>
    </form>
  );
}

// ---------- Практическая работа и рефлексия ----------

export function WorkForm({
  progress,
  disabled,
  onSubmit,
}: {
  progress: ElementProgress;
  disabled?: boolean;
  onSubmit: (answer: string) => Promise<unknown>;
}) {
  const [answer, setAnswer] = useState(progress.answer ?? '');
  const submit = useMutation({ mutationFn: () => onSubmit(answer) });
  const done = progress.status === 'WORK_DONE';
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Ответ на задание"
      onSubmit={(event) => {
        event.preventDefault();
        submit.mutate();
      }}
    >
      <Input.TextArea aria-label="Ваш ответ" rows={5} value={answer} disabled={disabled || done} onChange={(event) => setAnswer(event.target.value)} />
      {submit.isError && <Alert type="error" showIcon title={submit.error.message} />}
      <div className="flex items-center gap-3">
        <Button type="primary" htmlType="submit" disabled={disabled || done || !answer.trim()} loading={submit.isPending}>
          {progress.status === 'WORK_NOT_STARTED' ? 'Отправить на проверку' : 'Отправить повторно'}
        </Button>
        <ProgressTag progress={progress} />
      </div>
    </form>
  );
}

// ---------- Анкета ----------

function SectionForm({ section, clientSlug }: { section: ProfileFormSection; clientSlug: string }) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(section.fields.map((f) => [f.id, f.value])));
  const save = useMutation({
    mutationFn: () =>
      api.cabinet(clientSlug).saveProfileForm(Object.fromEntries(section.fields.filter((f) => !f.readonly).map((f) => [f.id, values[f.id] ?? '']))),
    onSuccess: (form) => {
      qc.setQueryData(queryKeys.profileForm(clientSlug), form);
      void qc.invalidateQueries({ queryKey: queryKeys.learnerCourses(clientSlug) });
      message.success('Анкета сохранена');
    },
  });
  const errors = isApiError(save.error) ? save.error.fieldErrors : {};
  const empty = (id: string) => !(values[id] ?? '').trim();
  const missing = section.fields.filter((f) => f.required && empty(f.id)).length;

  return (
    <form
      aria-label={section.title}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {missing > 0 && (
        <Alert
          className="mb-5"
          type="warning"
          showIcon
          title={section.id === 'trainer' ? `Заполните еще ${missing} полей анкеты` : `Заполните еще ${missing} полей для доступа к обучению`}
          description="Обязательные поля отмечены звёздочкой и выделены красной рамкой."
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => {
          const invalid = (field.required && empty(field.id)) || Boolean(errors[field.id]);
          const id = `profile-${section.id}-${field.id}`;
          return (
            <div key={field.id}>
              <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
                {field.label} {field.required && <span className="text-error">*</span>}
                {field.required && empty(field.id) && <Tag color="red" className="ml-2">Обязательно для заполнения</Tag>}
              </label>
              {field.type === 'DROPDOWN' ? (
                <Select
                  id={id}
                  className="w-full"
                  allowClear
                  disabled={field.readonly}
                  status={invalid ? 'error' : undefined}
                  value={values[field.id] || undefined}
                  options={field.options.map((o) => ({ value: o.id, label: o.label }))}
                  onChange={(value: string | undefined) => setValues((current) => ({ ...current, [field.id]: value ?? '' }))}
                />
              ) : (
                <Input
                  id={id}
                  disabled={field.readonly}
                  status={invalid ? 'error' : undefined}
                  value={values[field.id] ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
                />
              )}
              {errors[field.id] ? (
                <p role="alert" className="m-0 mt-1 text-xs text-error">{errors[field.id]}</p>
              ) : (
                field.readonly && <p className="m-0 mt-1 text-xs text-muted">Из учётной записи</p>
              )}
            </div>
          );
        })}
      </div>
      {save.isError && !Object.keys(errors).length && <Alert className="mt-4" type="error" showIcon title={save.error.message} />}
      <Button className="mt-5" type="primary" htmlType="submit" loading={save.isPending} disabled={section.fields.every((f) => f.readonly)}>
        Сохранить
      </Button>
    </form>
  );
}

/** Анкета пользователя: по вкладке на каждую группу (слушатель) или одна анкета тренера */
export function ProfileFormView({ form, clientSlug }: { form: ProfileForm; clientSlug: string }) {
  const sections = form.sections.filter((s) => s.fields.length);
  if (!sections.length) return null;
  // key: после сохранения форма пересоздаётся со значениями сервера
  const render = (s: ProfileFormSection) => <SectionForm key={`${s.id}:${s.fields.map((f) => f.value).join('|')}`} section={s} clientSlug={clientSlug} />;
  if (sections.length === 1) return <Card title={sections[0]!.title}>{render(sections[0]!)}</Card>;
  return <Card><Tabs items={sections.map((s) => ({ key: s.id, label: s.missing ? `${s.title} (${s.missing})` : s.title, children: render(s) }))} /></Card>;
}
