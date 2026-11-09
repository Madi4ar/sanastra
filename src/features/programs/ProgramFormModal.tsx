import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Input, InputNumber, Modal, Select, Tabs, Tag, Tooltip, Upload } from 'antd';
import { Bold, ImagePlus, Italic, Link2, List, ListOrdered, Trash2, Underline } from 'lucide-react';
import { useRef, useState } from 'react';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { Course, ProgramPayload } from '@/api/types';
import { useDirectoryOptions } from '@/features/directories/useDirectoryOptions';
import { Field } from '@/shared/FormField';
import { toRichText } from '@/shared/richText';

const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const COVER_LIMIT = 5 * 1024 * 1024;
/** Обложка уменьшается перед сохранением: в демо данные живут в хранилище браузера */
const COVER_MAX_SIDE = 800;

type Lang = 'Kz' | 'Ru' | 'En';
const LANGS: { key: Lang; label: string; required: boolean }[] = [
  { key: 'Kz', label: 'Казахский', required: true },
  { key: 'Ru', label: 'Русский', required: true },
  { key: 'En', label: 'Английский', required: true },
];

async function coverToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, COVER_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}

const TOOLS = [
  { label: 'Жирный', icon: <Bold size={14} />, command: 'bold' },
  { label: 'Курсив', icon: <Italic size={14} />, command: 'italic' },
  { label: 'Подчёркнутый', icon: <Underline size={14} />, command: 'underline' },
  { label: 'Маркированный список', icon: <List size={14} />, command: 'insertUnorderedList' },
  { label: 'Нумерованный список', icon: <ListOrdered size={14} />, command: 'insertOrderedList' },
  { label: 'Ссылка', icon: <Link2 size={14} />, command: 'createLink' },
];

/** Редактор форматированного текста: жирный, курсив, подчёркивание, списки, ссылки */
function RichTextEditor({ id, label, value, invalid, onChange }: { id: string; label: string; value: string; invalid: boolean; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Содержимое задаётся один раз: дальше редактор управляет им сам, иначе сбивается курсор
  const [initial] = useState(() => ({ __html: toRichText(value) }));
  const emit = () => onChange(ref.current?.innerHTML ?? '');
  const run = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };
  const onTool = (t: (typeof TOOLS)[number]) => {
    if (t.command !== 'createLink') {
      run(t.command);
      return;
    }
    const url = window.prompt('Адрес ссылки (https://…)');
    if (url && /^https?:\/\//i.test(url)) run(t.command, url);
  };
  return (
    <div className={`rounded-md border ${invalid ? 'border-error' : 'border-border'}`}>
      <div className="flex flex-wrap gap-1 border-b border-border p-1" role="toolbar" aria-label={`Форматирование: ${label}`}>
        {TOOLS.map((t) => (
          <Tooltip key={t.label} title={t.label}>
            <Button type="text" size="small" aria-label={t.label} icon={t.icon} onMouseDown={(e) => e.preventDefault()} onClick={() => onTool(t)} />
          </Tooltip>
        ))}
      </div>
      <div
        id={id}
        ref={ref}
        dangerouslySetInnerHTML={initial}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        className="rich-text min-h-28 p-3 text-sm outline-none"
        onInput={emit}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
          emit();
        }}
      />
    </div>
  );
}

const fromCourse = (c: Course | null): ProgramPayload => ({
  titleKz: c?.titleKz ?? '',
  titleRu: c?.titleRu ?? '',
  titleEn: c?.titleEn ?? '',
  descriptionKz: c?.descriptionKz ?? '',
  descriptionRu: c?.descriptionRu ?? '',
  descriptionEn: c?.descriptionEn ?? '',
  goalKz: c?.goalKz ?? '',
  goalRu: c?.goalRu ?? '',
  goalEn: c?.goalEn ?? '',
  resultKz: c?.resultKz ?? '',
  resultRu: c?.resultRu ?? '',
  resultEn: c?.resultEn ?? '',
  formatId: c?.formatId ?? null,
  assessmentId: c?.assessmentId ?? null,
  hoursTheory: c?.hoursTheory ?? null,
  hoursPractice: c?.hoursPractice ?? null,
  coverUrl: c?.coverUrl ?? null,
});

/** Форма создания и редактирования учебной программы */
export function ProgramFormModal({
  clientSlug,
  course,
  onClose,
  onSaved,
}: {
  clientSlug: string;
  course: Course | null;
  onClose: () => void;
  onSaved?: (c: Course) => void;
}) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const formats = useDirectoryOptions(clientSlug, 'course_format');
  const assessments = useDirectoryOptions(clientSlug, 'course_assessment');
  const [values, setValues] = useState(() => fromCourse(course));
  const [lang, setLang] = useState<Lang>('Kz');
  const [coverError, setCoverError] = useState<string>();
  const set = (patch: Partial<ProgramPayload>) => {
    setValues((v) => ({ ...v, ...patch }));
    // Ошибки проверки относятся к прошлой попытке сохранения
    save.reset();
  };

  const save = useMutation({
    mutationFn: () => (course ? admin.updateProgram(course.id, values) : admin.createProgram(values)),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tenantModuleData(clientSlug, 'COURSES') });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      void qc.invalidateQueries({ queryKey: queryKeys.courseContent(clientSlug, saved.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'groups') });
      message.success(course ? 'Программа сохранена' : 'Программа создана как черновик');
      onSaved?.(saved);
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  const other = save.isError && !Object.keys(fe).length ? save.error.message : null;
  const langHasError = (l: Lang) => [`title${l}`, `description${l}`, `goal${l}`, `result${l}`].some((k) => fe[k]);

  const pickCover = (file: File) => {
    setCoverError(undefined);
    if (!COVER_TYPES.includes(file.type)) setCoverError('Поддерживаются JPG, PNG и WebP');
    else if (file.size > COVER_LIMIT) setCoverError('Размер файла — до 5 МБ');
    else
      void coverToDataUrl(file)
        .then((coverUrl) => set({ coverUrl }))
        .catch(() => setCoverError('Не удалось прочитать изображение'));
    return false;
  };

  return (
    <Modal
      open
      width={820}
      title={course ? 'Редактирование программы' : 'Новая учебная программа'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      maskClosable={false}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2" data-testid="program-form">
        <Tabs
          activeKey={lang}
          onChange={(k) => setLang(k as Lang)}
          items={LANGS.map((l) => ({
            key: l.key,
            forceRender: true,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {l.label}
                {l.required && <span className="text-error">*</span>}
                {langHasError(l.key) && (
                  <Tag color="error" className="m-0 px-1 leading-4">
                    !
                  </Tag>
                )}
              </span>
            ),
            children: (
              <div className="flex flex-col gap-4">
                <Field label={`Название (${l.label.toLowerCase()} язык)`} htmlFor={`program-title-${l.key}`} required={l.required} error={fe[`title${l.key}`]}>
                  <Input
                    id={`program-title-${l.key}`}
                    maxLength={200}
                    status={fe[`title${l.key}`] ? 'error' : undefined}
                    value={values[`title${l.key}`]}
                    onChange={(e) => set({ [`title${l.key}`]: e.target.value })}
                  />
                </Field>
                <Field label={`Описание (${l.label.toLowerCase()} язык)`} htmlFor={`program-description-${l.key}`} required={l.required} error={fe[`description${l.key}`]}>
                  <RichTextEditor
                    id={`program-description-${l.key}`}
                    label={`Описание (${l.label.toLowerCase()} язык)`}
                    value={values[`description${l.key}`]}
                    invalid={Boolean(fe[`description${l.key}`])}
                    onChange={(v) => set({ [`description${l.key}`]: v })}
                  />
                </Field>
                <Field label={`Цель программы (${l.label.toLowerCase()} язык)`} htmlFor={`program-goal-${l.key}`} required={l.required} error={fe[`goal${l.key}`]}>
                  <RichTextEditor
                    id={`program-goal-${l.key}`}
                    label={`Цель программы (${l.label.toLowerCase()} язык)`}
                    value={values[`goal${l.key}`]}
                    invalid={Boolean(fe[`goal${l.key}`])}
                    onChange={(v) => set({ [`goal${l.key}`]: v })}
                  />
                </Field>
                <Field label={`Ожидаемый результат (${l.label.toLowerCase()} язык)`} htmlFor={`program-result-${l.key}`} required={l.required} error={fe[`result${l.key}`]}>
                  <RichTextEditor
                    id={`program-result-${l.key}`}
                    label={`Ожидаемый результат (${l.label.toLowerCase()} язык)`}
                    value={values[`result${l.key}`]}
                    invalid={Boolean(fe[`result${l.key}`])}
                    onChange={(v) => set({ [`result${l.key}`]: v })}
                  />
                </Field>
              </div>
            ),
          }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Формат курса" htmlFor="program-format" required error={fe.formatId}>
            <Select
              id="program-format"
              aria-label="Формат курса"
              style={{ width: '100%' }}
              placeholder="Выберите формат"
              status={fe.formatId ? 'error' : undefined}
              value={values.formatId ?? undefined}
              options={formats.data ?? []}
              onChange={(formatId) => set({ formatId })}
            />
          </Field>
          <Field label="Тип оценивания" htmlFor="program-assessment" required error={fe.assessmentId}>
            <Select
              id="program-assessment"
              aria-label="Тип оценивания"
              style={{ width: '100%' }}
              placeholder="Выберите тип"
              status={fe.assessmentId ? 'error' : undefined}
              value={values.assessmentId ?? undefined}
              options={assessments.data ?? []}
              onChange={(assessmentId) => set({ assessmentId })}
            />
          </Field>
          <Field label="Количество часов (теория)" htmlFor="program-theory" required error={fe.hoursTheory}>
            <InputNumber
              id="program-theory"
              style={{ width: '100%' }}
              min={1}
              precision={0}
              status={fe.hoursTheory ? 'error' : undefined}
              value={values.hoursTheory}
              onChange={(v) => set({ hoursTheory: v === null ? null : Number(v) })}
            />
          </Field>
          <Field label="Количество часов (практика)" htmlFor="program-practice" required error={fe.hoursPractice}>
            <InputNumber
              id="program-practice"
              style={{ width: '100%' }}
              min={1}
              precision={0}
              status={fe.hoursPractice ? 'error' : undefined}
              value={values.hoursPractice}
              onChange={(v) => set({ hoursPractice: v === null ? null : Number(v) })}
            />
          </Field>
        </div>
        <Field label="Обложка программы" htmlFor="program-cover" error={coverError ?? fe.coverUrl} hint="JPG, PNG или WebP, до 5 МБ">
          <div className="flex flex-wrap items-center gap-3" id="program-cover">
            {values.coverUrl && <img src={values.coverUrl} alt="Обложка программы" className="h-16 w-24 rounded-md object-cover" />}
            <Upload accept=".jpg,.jpeg,.png,.webp" showUploadList={false} beforeUpload={pickCover}>
              <Button icon={<ImagePlus size={16} />}>{values.coverUrl ? 'Заменить' : 'Загрузить'}</Button>
            </Upload>
            {values.coverUrl && (
              <Button icon={<Trash2 size={16} />} onClick={() => set({ coverUrl: null })}>
                Удалить
              </Button>
            )}
          </div>
        </Field>
        {other && <Alert type="error" showIcon title={other} />}
      </div>
    </Modal>
  );
}
