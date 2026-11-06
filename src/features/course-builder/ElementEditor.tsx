import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Drawer, Input, Modal, Segmented, Tabs, Tag } from 'antd';
import {
  AudioLines,
  BookOpenText,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Film,
  Folder,
  Image,
  Link2,
  ListChecks,
  MessageCircleQuestion,
  Package,
  Presentation,
  Table2,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CourseContent, CourseElement, ElementType } from '@/api/types';
import { Field } from '@/shared/FormField';
import { ELEMENT_HINT, ELEMENT_LABEL, ELEMENT_TYPES, readinessIssues, TAB_LABEL, tabsOf, validateElement } from './elementTypes';
import { SwitchField, type Lang } from './fields';
import { SettingsTabContent } from './SettingsForms';

export const ELEMENT_ICON: Record<ElementType, LucideIcon> = {
  text: BookOpenText,
  video: Video,
  interactive_video: Film,
  audio: AudioLines,
  document: FileText,
  presentation: Presentation,
  folder: Folder,
  image: Image,
  link: Link2,
  scorm: Package,
  assignment: ClipboardCheck,
  table: Table2,
  test: ListChecks,
  survey: ClipboardList,
  reflection: MessageCircleQuestion,
};

export function ElementIcon({ type, size = 18 }: { type: ElementType; size?: number }) {
  const Icon = ELEMENT_ICON[type];
  return <Icon size={size} aria-hidden />;
}

/** «Что добавить в день?» — выбор типа и названия нового элемента */
export function AddElementModal({
  clientSlug,
  courseId,
  dayId,
  onClose,
  onCreated,
}: {
  clientSlug: string;
  courseId: string;
  dayId: string;
  onClose: () => void;
  onCreated: (el: CourseElement) => void;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [type, setType] = useState<ElementType | null>(null);
  const [titleRu, setTitleRu] = useState('');
  const [titleKz, setTitleKz] = useState('');
  const [error, setError] = useState<string>();

  const create = useMutation({
    mutationFn: () => api.courseBuilder(clientSlug, courseId).addElement(dayId, type!, titleRu, titleKz),
    onSuccess: (el) => {
      void qc.invalidateQueries({ queryKey: queryKeys.courseContent(clientSlug, courseId) });
      message.success('Элемент добавлен');
      onCreated(el);
    },
    onError: (e) => {
      if (isApiError(e) && e.fieldErrors.titleRu) setError(e.fieldErrors.titleRu);
      else message.error(e.message);
    },
  });

  return (
    <Modal
      open
      width={760}
      title={type ? `Новый элемент: ${ELEMENT_LABEL[type]}` : 'Что добавить в день?'}
      onCancel={onClose}
      destroyOnHidden
      footer={
        type
          ? [
              <Button key="back" onClick={() => setType(null)}>
                Назад
              </Button>,
              <Button
                key="ok"
                type="primary"
                loading={create.isPending}
                disabled={!titleRu.trim() && !titleKz.trim()}
                onClick={() => create.mutate()}
              >
                Создать и настроить
              </Button>,
            ]
          : null
      }
    >
      {!type ? (
        <>
          <p className="m-0 mb-4 text-sm text-muted">Выберите тип — дальше откроются его настройки</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="element-type-picker">
            {ELEMENT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-transparent p-3 text-left transition-colors hover:border-primary hover:bg-primary-soft"
                onClick={() => setType(t)}
              >
                <span className="mt-0.5 text-primary">
                  <ElementIcon type={t} />
                </span>
                <span>
                  <span className="block text-sm font-medium">{ELEMENT_LABEL[t]}</span>
                  <span className="block text-xs text-muted">{ELEMENT_HINT[t]}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          className="flex flex-col gap-4 pt-2"
          aria-label="Новый элемент"
          onSubmit={(e) => {
            e.preventDefault();
            if (titleRu.trim() || titleKz.trim()) create.mutate();
          }}
        >
          <Field label="Название на казахском" htmlFor="new-el-kz">
            <Input id="new-el-kz" autoFocus maxLength={255} value={titleKz} onChange={(e) => setTitleKz(e.target.value)} />
          </Field>
          <Field label="Название на русском" htmlFor="new-el-ru" error={error}>
            <Input
              id="new-el-ru"
              maxLength={255}
              value={titleRu}
              status={error ? 'error' : undefined}
              onChange={(e) => {
                setTitleRu(e.target.value);
                setError(undefined);
              }}
            />
          </Field>
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}

/** Окно настроек элемента: общие поля и вкладки типа (ElementSettings::tabs) */
export function ElementEditor({
  clientSlug,
  courseId,
  element,
  onClose,
}: {
  clientSlug: string;
  courseId: string;
  element: CourseElement;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const [draft, setDraft] = useState(() => structuredClone(element));
  const [lang, setLang] = useState<Lang>('ru');
  const [tab, setTab] = useState(tabsOf(element.type)[0]!);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(element), [draft, element]);
  const localErrors = useMemo(() => validateElement(draft), [draft]);
  const errors = tried ? { ...serverErrors, ...localErrors } : serverErrors;
  const issues = readinessIssues(draft);
  const errorTabs = new Set<string>(
    Object.keys(errors).map((k) => {
      if (k.startsWith('settings.events')) return 'timeline';
      if (k.startsWith('settings.questions')) return 'questions';
      if (k.startsWith('settings.blocks')) return 'blocks';
      if (k === 'settings.table') return 'grid';
      if (/max_score|pass_score|max_rounds|max_attempts/.test(k) && draft.type !== 'test') return 'grading';
      if (/due_date/.test(k)) return 'dates';
      if (/attempts|time_limit|pass_percent|questions_per_page|pick_count/.test(k) && draft.type === 'test') return 'rules';
      if (/watch_percent|pass_percent/.test(k)) return 'playback';
      if (/max_files/.test(k)) return 'submission';
      return 'main';
    }),
  );

  const save = useMutation({
    mutationFn: () =>
      api.courseBuilder(clientSlug, courseId).updateElement(element.id, {
        titleRu: draft.titleRu,
        titleKz: draft.titleKz,
        required: draft.required,
        hidden: draft.hidden,
        settings: draft.settings,
        files: draft.files,
      }),
    onSuccess: (saved) => {
      qc.setQueryData<CourseContent>(queryKeys.courseContent(clientSlug, courseId), (prev) =>
        prev && {
          ...prev,
          modules: prev.modules.map((m) => ({
            ...m,
            days: m.days.map((d) => ({ ...d, elements: d.elements.map((e) => (e.id === saved.id ? saved : e)) })),
          })),
        },
      );
      void qc.invalidateQueries({ queryKey: queryKeys.courseContent(clientSlug, courseId) });
      message.success('Элемент сохранён');
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && Object.keys(e.fieldErrors).length) {
        setServerErrors(e.fieldErrors);
        message.error('Проверьте настройки элемента');
      } else message.error(e.message);
    },
  });

  const submit = () => {
    setTried(true);
    setServerErrors({});
    if (Object.keys(localErrors).length) {
      message.error('Проверьте настройки элемента');
      return;
    }
    save.mutate();
  };

  const close = () => {
    if (!dirty) return onClose();
    modal.confirm({
      title: 'Закрыть без сохранения?',
      content: 'Изменения в настройках элемента будут потеряны.',
      okText: 'Закрыть',
      cancelText: 'Продолжить редактирование',
      okButtonProps: { danger: true },
      onOk: onClose,
    });
  };

  const titleKey = lang === 'ru' ? 'titleRu' : 'titleKz';

  return (
    <Drawer
      open
      size={880}
      onClose={close}
      destroyOnHidden
      title={
        <span className="flex items-center gap-2">
          <ElementIcon type={element.type} />
          <span>{ELEMENT_LABEL[element.type]}</span>
        </span>
      }
      extra={
        <Segmented<Lang>
          aria-label="Язык заполнения"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'kz', label: 'KZ' },
            { value: 'ru', label: 'RU' },
          ]}
        />
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{dirty ? 'Есть несохранённые изменения' : 'Изменений нет'}</span>
          <span className="flex gap-2">
            <Button onClick={close}>Отмена</Button>
            <Button type="primary" loading={save.isPending} disabled={!dirty} onClick={submit}>
              Сохранить элемент
            </Button>
          </span>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        aria-label="Настройки элемента"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label={`Название ${lang === 'ru' ? 'на русском' : 'на казахском'}`} htmlFor="element-title" error={errors[titleKey]} required>
          <Input
            id="element-title"
            maxLength={255}
            value={draft[titleKey]}
            placeholder={lang === 'ru' ? draft.titleKz : draft.titleRu}
            status={errors[titleKey] ? 'error' : undefined}
            onChange={(e) => setDraft({ ...draft, [titleKey]: e.target.value })}
          />
        </Field>
        <div className="flex flex-wrap gap-6">
          <SwitchField
            label="Обязательный"
            hint="Нужен для завершения курса"
            checked={draft.required}
            onChange={(required) => setDraft({ ...draft, required })}
          />
          <SwitchField
            label="Скрыть от слушателей"
            hint="Элемент виден только в конструкторе"
            checked={draft.hidden}
            onChange={(hidden) => setDraft({ ...draft, hidden })}
          />
        </div>
        {issues.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="Элемент ещё не готов для слушателей"
            description={
              <ul className="m-0 pl-4">
                {issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            }
          />
        )}
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as typeof tab)}
          items={tabsOf(element.type).map((t) => ({
            key: t,
            label: (
              <span className="flex items-center gap-1.5">
                {TAB_LABEL[t]}
                {errorTabs.has(t) && <Tag color="error" className="m-0 px-1 leading-4">!</Tag>}
              </span>
            ),
            children: (
              <SettingsTabContent
                type={element.type}
                tab={t}
                settings={draft.settings}
                onSettings={(patch) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }))}
                files={draft.files}
                onFiles={(files) => setDraft((d) => ({ ...d, files }))}
                lang={lang}
                errors={errors}
              />
            ),
          }))}
        />
        <button type="submit" hidden />
      </form>
    </Drawer>
  );
}
