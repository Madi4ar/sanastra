import { Alert, DatePicker } from 'antd';
import dayjs from 'dayjs';
import type { ElementFile, ElementType } from '@/api/types';
import { API_DATE, UI_DATE } from '@/shared/format';
import { Field } from '@/shared/FormField';
import {
  ANSWER_LABEL,
  COOLDOWN_LABEL,
  COUNTED_LABEL,
  CUTOFF_LABEL,
  DEADLINE_LABEL,
  SIZES_MB,
  TEST_KIND_LABEL,
  type AnswerKind,
  type AssignmentSettings,
  type AudioSettings,
  type Cooldown,
  type Counted,
  type Cutoff,
  type Deadline,
  type FileViewSettings,
  type FolderSettings,
  type ImageSettings,
  type InteractiveVideoSettings,
  type LinkSettings,
  type LongreadSettings,
  type ReflectionSettings,
  type ScormSettings,
  type SettingsTab,
  type SurveySettings,
  type TableSettings,
  type TestKind,
  type TestSettings,
  type VideoSettings,
  type WorkSettings,
} from './elementTypes';
import { FilesField } from './FilesField';
import { Grid2, LangText, NumberField, SelectField, SwitchField, TextField, toOptions, type Errors, type Lang } from './fields';
import { FolderTree, LongreadBlocks, SurveyQuestions, TableGridEditor, TimelineEditor } from './StructuredEditors';
import { TestQuestions } from './TestQuestions';

export interface TabProps {
  type: ElementType;
  tab: SettingsTab;
  settings: Record<string, unknown>;
  onSettings: (patch: Record<string, unknown>) => void;
  files: ElementFile[];
  onFiles: (files: ElementFile[]) => void;
  lang: Lang;
  errors: Errors;
}

const err = (errors: Errors, key: string) => errors[`settings.${key}`];

/** Содержимое вкладки окна настроек элемента */
export function SettingsTabContent(p: TabProps) {
  const { type, tab, settings, onSettings, files, onFiles, lang, errors } = p;
  const text = (base: string, label: string, opts: { multiline?: boolean; rows?: number; maxLength?: number; hint?: string } = {}) => (
    <LangText base={base} label={label} lang={lang} values={settings} errors={errors} onChange={(k, v) => onSettings({ [k]: v })} {...opts} />
  );

  switch (type) {
    case 'video':
    case 'interactive_video': {
      const s = settings as unknown as InteractiveVideoSettings;
      if (tab === 'timeline')
        return <TimelineEditor events={s.events} lang={lang} errors={errors} onChange={(events) => onSettings({ events })} />;
      if (tab === 'playback')
        return (
          <div className="flex flex-col gap-4">
            <Grid2>
              <NumberField
                label="Засчитать после просмотра, %"
                min={10}
                max={100}
                value={s.watch_percent}
                error={err(errors, 'watch_percent')}
                hint="Для загруженного файла считается автоматически"
                onChange={(v) => onSettings({ watch_percent: v })}
              />
              {type === 'interactive_video' && (
                <NumberField
                  label="Проходной балл, %"
                  min={0}
                  max={100}
                  value={s.pass_percent}
                  error={err(errors, 'pass_percent')}
                  hint="Доля верных ответов на вопросы в видео"
                  onChange={(v) => onSettings({ pass_percent: v })}
                />
              )}
            </Grid2>
            {type === 'interactive_video' && (
              <SelectField<InteractiveVideoSettings['on_fail']>
                label="Если порог не пройден"
                value={s.on_fail}
                options={[
                  { value: 'rewind', label: 'Вернуть к фрагменту с ошибкой' },
                  { value: 'retry', label: 'Пересдать вопросы' },
                ]}
                onChange={(on_fail) => onSettings({ on_fail })}
              />
            )}
            <SwitchField label="Запретить перемотку вперёд при первом просмотре" checked={s.no_seek_first} onChange={(v) => onSettings({ no_seek_first: v })} />
            <SwitchField label="Разрешить менять скорость" checked={s.speed_control} onChange={(v) => onSettings({ speed_control: v })} />
            <p className="m-0 text-xs text-muted">Запрет перемотки и учёт просмотра работают для загруженного файла и YouTube.</p>
          </div>
        );
      return (
        <div className="flex flex-col gap-4">
          <SelectField<VideoSettings['source']>
            label="Источник видео"
            value={s.source}
            options={[
              { value: 'url', label: 'Ссылка' },
              { value: 'file', label: 'Файл' },
            ]}
            onChange={(source) => onSettings({ source })}
          />
          {s.source === 'url' ? (
            <TextField
              label="Ссылка на видео"
              value={s.url}
              error={err(errors, 'url')}
              placeholder="https://"
              hint={
                type === 'interactive_video'
                  ? 'Для вопросов и пауз нужно управлять плеером: подходит YouTube или загруженный файл.'
                  : 'YouTube, Vimeo или Kinescope — видео встроится в страницу.'
              }
              onChange={(v) => onSettings({ url: v.trim() || null })}
            />
          ) : (
            <FilesField type={type} files={files} onChange={onFiles} />
          )}
          <NumberField label="Длительность, мин" nullable min={1} max={600} value={s.duration_min} error={err(errors, 'duration_min')} onChange={(v) => onSettings({ duration_min: v })} />
          {text('note', 'Описание', { multiline: true, maxLength: 5000 })}
        </div>
      );
    }

    case 'text': {
      const s = settings as unknown as LongreadSettings;
      if (tab === 'blocks')
        return (
          <div className="flex flex-col gap-6">
            <LongreadBlocks blocks={s.blocks} files={files} lang={lang} errors={errors} onChange={(blocks) => onSettings({ blocks })} />
            <div>
              <p className="m-0 mb-2 text-sm font-medium">Файлы и картинки для блоков</p>
              <FilesField type="folder" files={files} onChange={onFiles} />
            </div>
          </div>
        );
      const key = lang === 'ru' ? 'read_min_ru' : 'read_min_kz';
      return (
        <div className="flex flex-col gap-4">
          <NumberField
            label={`Время чтения ${lang === 'ru' ? 'на русском' : 'на казахском'}, мин`}
            nullable
            min={1}
            max={600}
            value={s[key]}
            error={err(errors, key)}
            onChange={(v) => onSettings({ [key]: v })}
          />
          <SwitchField label="Показывать полосу прогресса чтения" checked={s.show_progress} onChange={(v) => onSettings({ show_progress: v })} />
          <SwitchField label="Оглавление по заголовкам" checked={s.auto_toc} onChange={(v) => onSettings({ auto_toc: v })} />
          <SwitchField label="Кнопка «Ознакомлен» в конце" checked={s.confirm_read} onChange={(v) => onSettings({ confirm_read: v })} />
          <p className="m-0 text-xs text-muted">Содержимое лонгрида собирается из блоков на вкладке «Блоки».</p>
        </div>
      );
    }

    case 'audio': {
      const s = settings as unknown as AudioSettings;
      return (
        <div className="flex flex-col gap-4">
          <FilesField type={type} files={files} onChange={onFiles} />
          <NumberField label="Длительность, мин" nullable min={1} max={600} value={s.duration_min} error={err(errors, 'duration_min')} onChange={(v) => onSettings({ duration_min: v })} />
          <SwitchField label="Разрешить менять скорость" checked={s.speed_control} onChange={(v) => onSettings({ speed_control: v })} />
          {text('transcript', 'Расшифровка', { multiline: true, rows: 6, maxLength: 50000 })}
        </div>
      );
    }

    case 'document':
    case 'presentation': {
      const s = settings as unknown as FileViewSettings;
      return (
        <div className="flex flex-col gap-4">
          <FilesField type={type} files={files} onChange={onFiles} />
          <SwitchField label="Показывать файл прямо на странице" checked={s.preview} onChange={(v) => onSettings({ preview: v })} />
          <SwitchField label="Разрешить скачивание" checked={s.downloadable} onChange={(v) => onSettings({ downloadable: v })} />
          <p className="m-0 text-xs text-muted">Word, Excel и PowerPoint при загрузке превращаются в PDF, чтобы слушатель видел файл без скачивания.</p>
        </div>
      );
    }

    case 'folder': {
      const s = settings as unknown as FolderSettings;
      return (
        <div className="flex flex-col gap-4">
          <FolderTree
            folders={s.folders}
            onFolders={(folders) => onSettings({ folders })}
            files={files}
            onFiles={onFiles}
            lang={lang}
            error={err(errors, 'folders')}
          />
          <SwitchField label="Показывать файлы прямо на странице" checked={s.preview} onChange={(v) => onSettings({ preview: v })} />
          <SwitchField label="Разрешить скачивание" checked={s.downloadable} onChange={(v) => onSettings({ downloadable: v })} />
        </div>
      );
    }

    case 'image': {
      const s = settings as unknown as ImageSettings;
      return (
        <div className="flex flex-col gap-4">
          <FilesField type={type} files={files} onChange={onFiles} />
          {text('caption', 'Подпись', { maxLength: 500 })}
          <SwitchField label="Увеличение по клику" checked={s.zoom} onChange={(v) => onSettings({ zoom: v })} />
        </div>
      );
    }

    case 'link': {
      const s = settings as unknown as LinkSettings;
      return (
        <div className="flex flex-col gap-4">
          <Grid2>
            <TextField label="Ссылка на казахском" placeholder="https://" value={s.url} error={err(errors, 'url')} onChange={(v) => onSettings({ url: v.trim() || null })} />
            <TextField label="Ссылка на русском" placeholder="https://" value={s.url_ru} error={err(errors, 'url_ru')} onChange={(v) => onSettings({ url_ru: v.trim() || null })} />
          </Grid2>
          <p className="m-0 -mt-2 text-xs text-muted">Если ссылка одна на оба языка, заполните только одно поле — её увидят все слушатели.</p>
          {text('note', 'Описание', { multiline: true, maxLength: 1000 })}
          <SwitchField label="Встроить видео на страницу, если это ссылка на YouTube, Vimeo или Kinescope" checked={s.embed} onChange={(v) => onSettings({ embed: v })} />
        </div>
      );
    }

    case 'scorm': {
      const s = settings as unknown as ScormSettings;
      if (tab === 'grading')
        return (
          <div className="flex flex-col gap-4">
            <SelectField<ScormSettings['complete_on']>
              label="Засчитать, когда пакет сообщит"
              value={s.complete_on}
              options={[
                { value: 'completed', label: 'Завершено (completed)' },
                { value: 'passed', label: 'Сдано (passed)' },
              ]}
              onChange={(complete_on) => onSettings({ complete_on })}
            />
            <Grid2>
              <NumberField label="Число попыток" nullable min={1} max={10} placeholder="без ограничений" value={s.max_attempts} error={err(errors, 'max_attempts')} onChange={(v) => onSettings({ max_attempts: v })} />
              <NumberField label="Проходной балл, %" nullable min={0} max={100} value={s.pass_score} error={err(errors, 'pass_score')} onChange={(v) => onSettings({ pass_score: v })} />
            </Grid2>
            <SelectField<ScormSettings['grading']>
              label="Засчитывается"
              value={s.grading}
              options={[
                { value: 'highest', label: 'лучший балл' },
                { value: 'last', label: 'последний балл' },
                { value: 'first', label: 'первый балл' },
              ]}
              onChange={(grading) => onSettings({ grading })}
            />
            <p className="m-0 text-xs text-muted">
              Балл берётся из пакета (score.raw или score.scaled). Если задан проходной балл, пакет засчитывается при статусе
              «пройден» или при балле не ниже проходного.
            </p>
          </div>
        );
      if (tab === 'display')
        return (
          <div className="flex flex-col gap-4">
            <SelectField<ScormSettings['display']>
              label="Где открывать"
              value={s.display}
              options={[
                { value: 'embedded', label: 'Внутри страницы' },
                { value: 'new_window', label: 'В новом окне' },
              ]}
              onChange={(display) => onSettings({ display })}
            />
            <SwitchField label="Кнопка «На весь экран»" checked={s.allow_fullscreen} onChange={(v) => onSettings({ allow_fullscreen: v })} />
          </div>
        );
      return (
        <div className="flex flex-col gap-4">
          <FilesField type={type} files={files} onChange={onFiles} />
          <SelectField<ScormSettings['version']>
            label="Версия SCORM"
            value={s.version}
            options={[
              { value: '1.2', label: 'SCORM 1.2' },
              { value: '2004', label: 'SCORM 2004' },
            ]}
            onChange={(version) => onSettings({ version })}
          />
          <p className="m-0 text-xs text-muted">
            Поддерживаются SCORM 1.2 и SCORM 2004. Пакет на казахском и на русском загружается отдельно: выберите язык рядом
            с кнопкой загрузки.
          </p>
        </div>
      );
    }

    case 'assignment':
    case 'table': {
      const s = settings as unknown as AssignmentSettings & TableSettings;
      if (tab === 'grid')
        return <TableGridEditor grid={s.table} lang={lang} error={err(errors, 'table')} onChange={(table) => onSettings({ table })} />;
      if (tab === 'submission')
        return (
          <div className="flex flex-col gap-4">
            <SelectField<AnswerKind> label="Как сдавать" value={s.answer} options={toOptions(ANSWER_LABEL)} onChange={(answer) => onSettings({ answer })} />
            {s.answer !== 'text' && (
              <Grid2>
                <NumberField label="Файлов не больше" min={1} max={20} value={s.max_files} error={err(errors, 'max_files')} onChange={(v) => onSettings({ max_files: v })} />
                <SelectField<number>
                  label="Размер одного файла до"
                  value={s.max_size_mb}
                  options={SIZES_MB.map((m) => ({ value: m, label: `${m} МБ` }))}
                  onChange={(max_size_mb) => onSettings({ max_size_mb })}
                />
              </Grid2>
            )}
            <Alert type="info" showIcon title="Отправлено → на проверке → на доработке → версия 2 → принято. История версий сохраняется." />
          </div>
        );
      if (tab === 'dates') return <WorkDates s={s} onSettings={onSettings} errors={errors} />;
      if (tab === 'grading') return <WorkGrading s={s} onSettings={onSettings} errors={errors} />;
      return (
        <div className="flex flex-col gap-4">
          {text('task', 'Задание', { multiline: true, rows: 6, maxLength: 20000 })}
          {text('criteria', 'Критерии оценки', { multiline: true, rows: 4, maxLength: 20000 })}
        </div>
      );
    }

    case 'test': {
      const s = settings as unknown as TestSettings;
      if (tab === 'questions') return <TestQuestions questions={s.questions} lang={lang} onChange={(questions) => onSettings({ questions })} />;
      if (tab === 'rules')
        return (
          <div className="flex flex-col gap-4">
            <Grid2>
              <NumberField label="Попыток" nullable min={1} max={100} placeholder="без ограничений" value={s.attempts} error={err(errors, 'attempts')} onChange={(v) => onSettings({ attempts: v })} />
              <NumberField label="Время на попытку, мин" nullable min={1} max={600} placeholder="не ограничено" value={s.time_limit} error={err(errors, 'time_limit')} onChange={(v) => onSettings({ time_limit: v })} />
              <NumberField label="Проходной балл, %" min={0} max={100} value={s.pass_percent} error={err(errors, 'pass_percent')} onChange={(v) => onSettings({ pass_percent: v })} />
              <SelectField<Cooldown> label="Между попытками" value={s.cooldown} options={toOptions(COOLDOWN_LABEL)} onChange={(cooldown) => onSettings({ cooldown })} />
              <SelectField<Counted> label="В зачёт идёт" value={s.counted} options={toOptions(COUNTED_LABEL)} onChange={(counted) => onSettings({ counted })} />
              <NumberField label="Вопросов на странице" min={1} max={50} value={s.questions_per_page} error={err(errors, 'questions_per_page')} onChange={(v) => onSettings({ questions_per_page: v })} />
              <NumberField
                label="Брать из банка вопросов"
                nullable
                min={1}
                max={200}
                placeholder="все"
                value={s.pick_count}
                error={err(errors, 'pick_count')}
                hint="Каждый слушатель получит столько случайных вопросов."
                onChange={(v) => onSettings({ pick_count: v })}
              />
            </Grid2>
            <SwitchField label="Перемешивать вопросы" checked={s.shuffle_questions} onChange={(v) => onSettings({ shuffle_questions: v })} />
            <SwitchField label="Перемешивать варианты ответа" checked={s.shuffle_options} onChange={(v) => onSettings({ shuffle_options: v })} />
            <SwitchField label="Показывать слушателю процент" checked={s.show_percent} onChange={(v) => onSettings({ show_percent: v })} />
          </div>
        );
      if (tab === 'feedback')
        return (
          <div className="flex flex-col gap-4">
            {text('feedback_pass', 'Сообщение при успешной сдаче', { multiline: true, maxLength: 2000 })}
            {text('feedback_fail', 'Сообщение, если тест не сдан', { multiline: true, maxLength: 2000 })}
          </div>
        );
      return <SelectField<TestKind> label="Вид теста" value={s.kind} options={toOptions(TEST_KIND_LABEL)} onChange={(kind) => onSettings({ kind })} />;
    }

    case 'survey': {
      const s = settings as unknown as SurveySettings;
      if (tab === 'questions') return <SurveyQuestions questions={s.questions} lang={lang} errors={errors} onChange={(questions) => onSettings({ questions })} />;
      return (
        <div className="flex flex-col gap-4">
          <SwitchField
            label="Открывать после обязательных элементов"
            hint="Анкета станет доступна, когда слушатель пройдёт обязательные элементы курса."
            checked={s.after_required}
            onChange={(v) => onSettings({ after_required: v })}
          />
          <SwitchField label="Анонимная анкета" hint="Тренер видит ответы без имени слушателя." checked={s.anonymous} onChange={(v) => onSettings({ anonymous: v })} />
        </div>
      );
    }

    case 'reflection': {
      const s = settings as unknown as ReflectionSettings;
      return (
        <div className="flex flex-col gap-4">
          {text('question', 'Вопрос', { multiline: true, maxLength: 2000 })}
          <NumberField label="Ответ до, знаков" min={50} max={5000} value={s.limit} error={err(errors, 'limit')} onChange={(v) => onSettings({ limit: v })} />
        </div>
      );
    }
  }
}

function WorkDates({ s, onSettings, errors }: { s: WorkSettings; onSettings: TabProps['onSettings']; errors: Errors }) {
  return (
    <div className="flex flex-col gap-4">
      <SelectField<Deadline> label="Срок сдачи" value={s.deadline} options={toOptions(DEADLINE_LABEL)} onChange={(deadline) => onSettings({ deadline })} />
      {s.deadline === 'date' && (
        <Field label="Дата" htmlFor="work-due-date" error={err(errors, 'due_date')}>
          <DatePicker
            id="work-due-date"
            format={UI_DATE}
            className="w-full"
            value={s.due_date ? dayjs(s.due_date) : null}
            onChange={(d) => onSettings({ due_date: d ? d.format(API_DATE) : null })}
          />
        </Field>
      )}
      <SelectField<Cutoff>
        label="После срока принимать ещё"
        value={s.cutoff}
        options={toOptions(CUTOFF_LABEL)}
        hint="Работа, сданная после срока, получит пометку «Просрочено»."
        onChange={(cutoff) => onSettings({ cutoff })}
      />
    </div>
  );
}

function WorkGrading({ s, onSettings, errors }: { s: WorkSettings; onSettings: TabProps['onSettings']; errors: Errors }) {
  return (
    <div className="flex flex-col gap-4">
      <SwitchField
        label="Оцениваемая работа"
        hint="Тренер ставит балл. Без оценки работу только принимают или возвращают на доработку."
        checked={s.graded}
        onChange={(graded) => onSettings({ graded })}
      />
      {s.graded && (
        <Grid2>
          <NumberField label="Максимальный балл" min={1} max={100} value={s.max_score} error={err(errors, 'max_score')} onChange={(v) => onSettings({ max_score: v })} />
          <NumberField label="Проходной балл" min={0} max={100} value={s.pass_score} error={err(errors, 'pass_score')} onChange={(v) => onSettings({ pass_score: v })} />
        </Grid2>
      )}
      <SwitchField label="Тренер может вернуть работу на доработку" checked={s.allow_resubmit} onChange={(allow_resubmit) => onSettings({ allow_resubmit })} />
      {s.allow_resubmit && (
        <NumberField label="Сколько раз можно сдавать" min={1} max={10} value={s.max_rounds} error={err(errors, 'max_rounds')} onChange={(v) => onSettings({ max_rounds: v })} />
      )}
    </div>
  );
}
