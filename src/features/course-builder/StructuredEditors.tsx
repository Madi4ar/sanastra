import { Alert, Button, Card, Checkbox, Dropdown, Empty, Input, Select, Tag } from 'antd';
import { ArrowDown, ArrowUp, ChevronDown, Columns3, FolderPlus, Plus, Rows3, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ElementFile } from '@/api/types';
import { IconButton } from '@/shared/IconButton';
import {
  blankBlock,
  blankEvent,
  BLOCK_HAS_TEXT,
  BLOCK_HAS_TITLE,
  BLOCK_KINDS,
  BLOCK_LABEL,
  EVENT_LABEL,
  formatTime,
  MAX_FOLDER_DEPTH,
  MAX_FOLDERS,
  parseTime,
  SURVEY_KIND_LABEL,
  SURVEY_KINDS,
  TABLE_MAX_COLS,
  TABLE_MAX_ROWS,
  TONE_LABEL,
  uid,
  VIDEO_QUESTION_LABEL,
  type BlockKind,
  type CalloutTone,
  type EventKind,
  type FolderNode,
  type LongreadBlock,
  type SurveyKind,
  type SurveyQuestion,
  type TableGrid,
  type TimelineEvent,
  type VideoQuestionKind,
} from './elementTypes';
import { FilesField } from './FilesField';
import { LANG_LABEL, SelectField, SwitchField, TextField, toOptions, type Errors, type Lang } from './fields';
import { ListEditor, moveItem } from './ListEditor';

// ---- интерактивная таблица (TableGrid) ----

export function TableGridEditor({
  grid,
  onChange,
  lang,
  error,
}: {
  grid: TableGrid;
  onChange: (g: TableGrid) => void;
  lang: Lang;
  error?: string;
}) {
  const cols = grid.rows[0]?.cells.length ?? 0;
  const setCell = (rowId: string, cellId: string, patch: Partial<TableGrid['rows'][number]['cells'][number]>) =>
    onChange({
      ...grid,
      rows: grid.rows.map((r) =>
        r.id === rowId ? { ...r, cells: r.cells.map((c) => (c.id === cellId ? { ...c, ...patch } : c)) } : r,
      ),
    });
  const addRow = () =>
    onChange({
      ...grid,
      rows: [...grid.rows, { id: uid('r'), cells: Array.from({ length: Math.max(1, cols) }, (_, i) => ({ id: uid('c'), input: i > 0, ru: '', kz: '' })) }],
    });
  const addCol = () =>
    onChange({ ...grid, rows: grid.rows.map((r, i) => ({ ...r, cells: [...r.cells, { id: uid('c'), input: !(grid.header_row && i === 0), ru: '', kz: '' }] })) });
  const removeCol = (j: number) => onChange({ ...grid, rows: grid.rows.map((r) => ({ ...r, cells: r.cells.filter((_, k) => k !== j) })) });

  return (
    <div className="flex flex-col gap-3" data-testid="table-grid">
      <p className="m-0 text-sm text-muted">
        Задайте неизменяемые ячейки (вопросы, задания, инструкции) и отметьте ячейки, которые заполняет слушатель — для них
        текст является подсказкой. Слушатель не может изменить или удалить фиксированные ячейки.
      </p>
      <div className="flex flex-wrap gap-4">
        <SwitchField label="Первая строка — заголовок" checked={grid.header_row} onChange={(v) => onChange({ ...grid, header_row: v })} />
        <SwitchField label="Первый столбец — заголовок" checked={grid.header_col} onChange={(v) => onChange({ ...grid, header_col: v })} />
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {grid.rows.map((r, i) => (
              <tr key={r.id}>
                {r.cells.map((c, j) => {
                  const header = (grid.header_row && i === 0) || (grid.header_col && j === 0);
                  return (
                    <td key={c.id} className={`border border-border p-1.5 align-top ${header ? 'bg-subtle' : ''}`} style={{ minWidth: 160 }}>
                      <Input.TextArea
                        aria-label={`Ячейка ${i + 1}.${j + 1}`}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        placeholder={c.input ? 'Подсказка для слушателя' : header ? 'Заголовок' : 'Текст ячейки'}
                        value={c[lang]}
                        className={header ? 'font-semibold' : undefined}
                        onChange={(e) => setCell(r.id, c.id, { [lang]: e.target.value })}
                      />
                      <Checkbox className="mt-1 text-xs" checked={c.input} onChange={(e) => setCell(r.id, c.id, { input: e.target.checked })}>
                        <span className="text-xs">Заполняет слушатель</span>
                      </Checkbox>
                    </td>
                  );
                })}
                <td className="w-8 align-middle">
                  <IconButton
                    type="text"
                    danger
                    size="small"
                    label={`Удалить строку ${i + 1}`}
                    icon={<Trash2 size={14} />}
                    disabled={grid.rows.length <= 1}
                    onClick={() => onChange({ ...grid, rows: grid.rows.filter((x) => x.id !== r.id) })}
                  />
                </td>
              </tr>
            ))}
            <tr>
              {Array.from({ length: cols }, (_, j) => (
                <td key={j} className="text-center">
                  <IconButton
                    type="text"
                    danger
                    size="small"
                    label={`Удалить столбец ${j + 1}`}
                    icon={<Trash2 size={14} />}
                    disabled={cols <= 1}
                    onClick={() => removeCol(j)}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <Button size="small" icon={<Rows3 size={14} />} disabled={grid.rows.length >= TABLE_MAX_ROWS} onClick={addRow}>
          Добавить строку
        </Button>
        <Button size="small" icon={<Columns3 size={14} />} disabled={cols >= TABLE_MAX_COLS} onClick={addCol}>
          Добавить столбец
        </Button>
      </div>
    </div>
  );
}

// ---- события интерактивного видео ----

export function TimelineEditor({
  events,
  onChange,
  lang,
  errors,
}: {
  events: TimelineEvent[];
  onChange: (e: TimelineEvent[]) => void;
  lang: Lang;
  errors: Errors;
}) {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const update = (id: string, patch: Partial<TimelineEvent>) => onChange(events.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const last = sorted.at(-1)?.at ?? 0;

  return (
    <div className="flex flex-col gap-3" data-testid="timeline">
      <p className="m-0 text-sm text-muted">
        События срабатывают на заданной минуте: видео встаёт на паузу и показывает вопрос, задание, выбор ветки или подсказку.
        Время — в формате мм:сс.
      </p>
      {!sorted.length && <Empty description="Событий пока нет" />}
      {sorted.map((ev) => {
        const i = events.indexOf(ev);
        const err = (k: string) => errors[`settings.events.${i}.${k}`];
        const tKey = lang === 'ru' ? 'text_ru' : 'text_kz';
        const titleKey = lang === 'ru' ? 'title_ru' : 'title_kz';
        return (
          <Card
            key={ev.id}
            size="small"
            title={
              <span className="flex items-center gap-2">
                <Tag className="mono">{formatTime(ev.at)}</Tag>
                {EVENT_LABEL[ev.kind]}
              </span>
            }
            extra={
              <IconButton
                type="text"
                danger
                size="small"
                label={`Удалить событие ${formatTime(ev.at)}`}
                icon={<Trash2 size={14} />}
                onClick={() => onChange(events.filter((x) => x.id !== ev.id))}
              />
            }
          >
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                <TimeInput value={ev.at} error={err('at')} onChange={(at) => update(ev.id, { at })} />
                <SelectField<EventKind>
                  label="Событие"
                  value={ev.kind}
                  options={toOptions(EVENT_LABEL)}
                  onChange={(kind) => update(ev.id, { ...blankEvent(ev.at, kind), id: ev.id })}
                />
              </div>
              {ev.kind === 'chapter' && (
                <TextField label={`Название главы ${LANG_LABEL[lang]}`} value={ev[titleKey]} onChange={(v) => update(ev.id, { [titleKey]: v })} />
              )}
              {ev.kind !== 'chapter' && (
                <TextField
                  label={ev.kind === 'question' ? `Вопрос ${LANG_LABEL[lang]}` : `Текст ${LANG_LABEL[lang]}`}
                  multiline
                  rows={2}
                  value={ev[tKey]}
                  onChange={(v) => update(ev.id, { [tKey]: v })}
                />
              )}
              {ev.kind === 'hotspot' && (
                <TextField label="Ссылка в подсказке (необязательно)" value={ev.url} error={err('url')} onChange={(v) => update(ev.id, { url: v || null })} />
              )}
              {ev.kind === 'question' && (
                <SelectField<VideoQuestionKind>
                  label="Тип вопроса"
                  value={ev.question_kind ?? 'single'}
                  options={toOptions(VIDEO_QUESTION_LABEL)}
                  onChange={(question_kind) =>
                    update(ev.id, {
                      question_kind,
                      options:
                        question_kind === 'truefalse'
                          ? [
                              { id: uid('o'), ru: 'Верно', kz: 'Дұрыс', correct: true, goto: null },
                              { id: uid('o'), ru: 'Неверно', kz: 'Бұрыс', correct: false, goto: null },
                            ]
                          : question_kind === 'text'
                            ? []
                            : ev.options,
                    })
                  }
                />
              )}
              {((ev.kind === 'question' && ev.question_kind !== 'text') || ev.kind === 'branch') && (
                <div>
                  <p className="m-0 mb-2 text-sm font-medium">
                    {ev.kind === 'branch' ? 'Варианты выбора и секунда, куда перейти' : 'Варианты ответа — отметьте верные'}
                  </p>
                  <ListEditor
                    items={ev.options}
                    onChange={(options) => update(ev.id, { options })}
                    lang={lang}
                    mark={ev.kind === 'question' ? (ev.question_kind === 'multiple' ? 'multiple' : 'single') : undefined}
                    min={2}
                    max={8}
                    label={(j) => `Вариант ${j + 1}`}
                    addLabel="Добавить вариант"
                    make={() => ({ id: uid('o'), ru: '', kz: '', correct: false, goto: null })}
                    extra={
                      ev.kind === 'branch'
                        ? (o) => (
                            <Input
                              aria-label="Перейти на, мм:сс"
                              placeholder="мм:сс"
                              style={{ width: 90 }}
                              defaultValue={o.goto === null ? '' : formatTime(o.goto)}
                              onBlur={(e) =>
                                update(ev.id, { options: ev.options.map((x) => (x.id === o.id ? { ...x, goto: parseTime(e.target.value) } : x)) })
                              }
                            />
                          )
                        : undefined
                    }
                  />
                  {err('options') && <p role="alert" className="m-0 mt-1 text-xs text-error">{err('options')}</p>}
                </div>
              )}
              {ev.kind !== 'chapter' && (
                <SwitchField label="Пауза до ответа" checked={ev.autopause} onChange={(autopause) => update(ev.id, { autopause })} />
              )}
            </div>
          </Card>
        );
      })}
      <div>
        <Button icon={<Plus size={16} />} disabled={events.length >= 100} onClick={() => onChange([...events, blankEvent(last + 60)])}>
          Добавить событие
        </Button>
      </div>
    </div>
  );
}

function TimeInput({ value, onChange, error }: { value: number; onChange: (v: number) => void; error?: string }) {
  const [text, setText] = useState(formatTime(value));
  const [bad, setBad] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        Время, мм:сс
        <Input
          className="mono mt-1.5"
          value={text}
          status={bad || error ? 'error' : undefined}
          onChange={(e) => {
            setText(e.target.value);
            const sec = parseTime(e.target.value);
            setBad(sec === null);
            if (sec !== null) onChange(sec);
          }}
        />
      </label>
      {(bad || error) && <p role="alert" className="m-0 mt-1 text-xs text-error">{error ?? 'Формат мм:сс'}</p>}
    </div>
  );
}

// ---- блоки лонгрида ----

export function LongreadBlocks({
  blocks,
  onChange,
  lang,
  errors,
  files,
}: {
  blocks: LongreadBlock[];
  onChange: (b: LongreadBlock[]) => void;
  lang: Lang;
  errors: Errors;
  files: ElementFile[];
}) {
  const update = (id: string, patch: Partial<LongreadBlock>) => onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const textHint: Partial<Record<BlockKind, string>> = {
    list: 'Каждый пункт — с новой строки.',
    table: 'Строка таблицы — с новой строки, ячейки разделяйте знаком | . Первая строка — заголовок.',
  };

  return (
    <div className="flex flex-col gap-3" data-testid="longread-blocks">
      <p className="m-0 text-sm text-muted">Лонгрид собирается из блоков: слушатель видит его одной страницей с оглавлением по заголовкам.</p>
      {!blocks.length && <Empty description="Блоков пока нет" />}
      {blocks.map((b, i) => {
        const tKey = lang === 'ru' ? 'text_ru' : 'text_kz';
        const titleKey = lang === 'ru' ? 'title_ru' : 'title_kz';
        return (
          <Card
            key={b.id}
            size="small"
            title={<Tag>{BLOCK_LABEL[b.kind]}</Tag>}
            extra={
              <span className="flex items-center gap-1">
                <IconButton type="text" size="small" label="Выше" icon={<ArrowUp size={14} />} disabled={i === 0} onClick={() => onChange(moveItem(blocks, i, -1))} />
                <IconButton type="text" size="small" label="Ниже" icon={<ArrowDown size={14} />} disabled={i === blocks.length - 1} onClick={() => onChange(moveItem(blocks, i, 1))} />
                <IconButton
                  type="text"
                  danger
                  size="small"
                  label={`Удалить блок ${i + 1}`}
                  icon={<Trash2 size={14} />}
                  onClick={() => onChange(blocks.filter((x) => x.id !== b.id))}
                />
              </span>
            }
          >
            <div className="flex flex-col gap-3">
              {b.kind === 'callout' && (
                <SelectField<CalloutTone> label="Вид выноски" value={b.tone} options={toOptions(TONE_LABEL)} onChange={(tone) => update(b.id, { tone })} />
              )}
              {BLOCK_HAS_TITLE.includes(b.kind) && (
                <TextField
                  label={`${b.kind === 'image' || b.kind === 'embed' ? 'Подпись' : 'Заголовок'} ${LANG_LABEL[lang]}`}
                  value={b[titleKey]}
                  onChange={(v) => update(b.id, { [titleKey]: v })}
                />
              )}
              {BLOCK_HAS_TEXT.includes(b.kind) && (
                <TextField
                  label={`${b.kind === 'heading' ? 'Заголовок' : 'Текст'} ${LANG_LABEL[lang]}`}
                  multiline={b.kind !== 'heading'}
                  rows={b.kind === 'paragraph' ? 5 : 3}
                  value={b[tKey]}
                  error={errors[`settings.blocks.${i}.${tKey}`]}
                  hint={textHint[b.kind]}
                  onChange={(v) => update(b.id, { [tKey]: v })}
                />
              )}
              {b.kind === 'embed' && (
                <TextField
                  label="Ссылка"
                  value={b.url}
                  error={errors[`settings.blocks.${i}.url`]}
                  hint="Ссылка на YouTube, Vimeo, Kinescope или другой ресурс, который разрешает встраивание."
                  onChange={(v) => update(b.id, { url: v || null })}
                />
              )}
              {(b.kind === 'image' || b.kind === 'file') && (
                <SelectField<string>
                  label="Файл"
                  value={b.file_id ?? ''}
                  hint="Сначала загрузите файл ниже, затем выберите его здесь."
                  options={[
                    { value: '', label: 'Выберите загруженный файл' },
                    ...files
                      .filter((f) => b.kind === 'file' || f.mime.startsWith('image/'))
                      .map((f) => ({ value: f.id, label: f.name })),
                  ]}
                  onChange={(v) => update(b.id, { file_id: v || null })}
                />
              )}
            </div>
          </Card>
        );
      })}
      <div>
        <Dropdown
          trigger={['click']}
          menu={{ items: BLOCK_KINDS.map((k) => ({ key: k, label: BLOCK_LABEL[k] })), onClick: ({ key }) => onChange([...blocks, blankBlock(key as BlockKind)]) }}
        >
          <Button icon={<Plus size={16} />}>
            Добавить блок <ChevronDown size={14} />
          </Button>
        </Dropdown>
      </div>
    </div>
  );
}

// ---- папки ----

export function FolderTree({
  folders,
  onFolders,
  files,
  onFiles,
  lang,
  error,
}: {
  folders: FolderNode[];
  onFolders: (f: FolderNode[]) => void;
  files: ElementFile[];
  onFiles: (f: ElementFile[]) => void;
  lang: Lang;
  error?: string;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const nameOf = (f: FolderNode) => (lang === 'ru' ? f.title_ru || f.title_kz : f.title_kz || f.title_ru) || 'Без названия';
  const path: FolderNode[] = [];
  for (let id = current; id; ) {
    const f = folders.find((x) => x.id === id);
    if (!f) break;
    path.unshift(f);
    id = f.parentId;
  }
  const children = folders.filter((f) => f.parentId === current);
  const titleKey = lang === 'ru' ? 'title_ru' : 'title_kz';
  const options = folders.map((f) => ({ value: f.id, label: nameOf(f) }));

  const removeFolder = (id: string) => {
    // папка удаляется вместе с вложенными папками и файлами
    const ids = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const f of folders)
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          grew = true;
        }
    }
    onFolders(folders.filter((f) => !ids.has(f.id)));
    onFiles(files.filter((f) => !f.folderId || !ids.has(f.folderId)));
  };

  return (
    <div className="flex flex-col gap-3" data-testid="folder-tree">
      <nav aria-label="Путь" className="flex flex-wrap items-center gap-1 text-sm">
        <Button size="small" type={current === null ? 'primary' : 'text'} onClick={() => setCurrent(null)}>
          Корень
        </Button>
        {path.map((f) => (
          <span key={f.id} className="flex items-center gap-1">
            <span className="text-muted">/</span>
            <Button size="small" type={f.id === current ? 'primary' : 'text'} onClick={() => setCurrent(f.id)}>
              {nameOf(f)}
            </Button>
          </span>
        ))}
      </nav>
      {error && <Alert type="error" showIcon title={error} />}
      {children.map((f) => (
        <div key={f.id} className="flex items-center gap-2">
          <Input
            aria-label={`Название папки ${LANG_LABEL[lang]}`}
            value={f[titleKey]}
            placeholder="Название папки"
            onChange={(e) => onFolders(folders.map((x) => (x.id === f.id ? { ...x, [titleKey]: e.target.value } : x)))}
          />
          <Button size="small" onClick={() => setCurrent(f.id)}>
            Открыть ({files.filter((x) => x.folderId === f.id).length + folders.filter((x) => x.parentId === f.id).length})
          </Button>
          <IconButton type="text" danger size="small" label={`Удалить папку «${nameOf(f)}»`} icon={<Trash2 size={14} />} onClick={() => removeFolder(f.id)} />
        </div>
      ))}
      <div>
        <Button
          size="small"
          icon={<FolderPlus size={14} />}
          disabled={folders.length >= MAX_FOLDERS || path.length >= MAX_FOLDER_DEPTH}
          onClick={() => onFolders([...folders, { id: uid('fd'), parentId: current, title_ru: 'Новая папка', title_kz: 'Жаңа папка' }])}
        >
          Создать папку
        </Button>
      </div>
      <FilesField type="folder" files={files} onChange={onFiles} folderId={current} folderOptions={options} />
    </div>
  );
}

// ---- анкета ----

export function SurveyQuestions({
  questions,
  onChange,
  lang,
  errors,
}: {
  questions: SurveyQuestion[];
  onChange: (q: SurveyQuestion[]) => void;
  lang: Lang;
  errors: Errors;
}) {
  const update = (id: string, patch: Partial<SurveyQuestion>) => onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  return (
    <div className="flex flex-col gap-3" data-testid="survey-questions">
      {!questions.length && <Empty description="Вопросов пока нет" />}
      {questions.map((q, i) => (
        <Card
          key={q.id}
          size="small"
          title={`Вопрос ${i + 1}`}
          extra={
            <span className="flex items-center gap-1">
              <IconButton type="text" size="small" label="Выше" icon={<ArrowUp size={14} />} disabled={i === 0} onClick={() => onChange(moveItem(questions, i, -1))} />
              <IconButton type="text" size="small" label="Ниже" icon={<ArrowDown size={14} />} disabled={i === questions.length - 1} onClick={() => onChange(moveItem(questions, i, 1))} />
              <IconButton
                type="text"
                danger
                size="small"
                label={`Удалить вопрос анкеты ${i + 1}`}
                icon={<Trash2 size={14} />}
                onClick={() => onChange(questions.filter((x) => x.id !== q.id))}
              />
            </span>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <TextField
                label={`Вопрос ${LANG_LABEL[lang]}`}
                value={q[lang]}
                error={errors[`settings.questions.${i}`]}
                onChange={(v) => update(q.id, { [lang]: v })}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Тип ответа
                  <Select<SurveyKind>
                    aria-label="Тип ответа"
                    className="mt-1.5 w-full"
                    style={{ width: '100%' }}
                    value={q.kind}
                    options={SURVEY_KINDS.map((k) => ({ value: k, label: SURVEY_KIND_LABEL[k] }))}
                    onChange={(kind) =>
                      update(q.id, {
                        kind,
                        options:
                          (kind === 'single' || kind === 'multiple') && q.options.length < 2
                            ? [
                                { id: uid('o'), ru: '', kz: '' },
                                { id: uid('o'), ru: '', kz: '' },
                              ]
                            : q.options,
                      })
                    }
                  />
                </label>
              </div>
            </div>
            {(q.kind === 'single' || q.kind === 'multiple') && (
              <ListEditor
                items={q.options}
                onChange={(options) => update(q.id, { options })}
                lang={lang}
                min={2}
                max={10}
                label={(j) => `Вариант ${j + 1}`}
                addLabel="Добавить вариант"
                make={() => ({ id: uid('o'), ru: '', kz: '' })}
              />
            )}
            <SwitchField label="Обязательный вопрос" checked={q.required} onChange={(required) => update(q.id, { required })} />
          </div>
        </Card>
      ))}
      <div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => onChange([...questions, { id: uid('sq'), kind: 'text', ru: '', kz: '', required: true, options: [] }])}
        >
          Добавить вопрос
        </Button>
      </div>
    </div>
  );
}
