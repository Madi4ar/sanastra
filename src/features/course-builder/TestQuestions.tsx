import { Alert, Button, Card, Dropdown, Empty, Input, Radio, Tag } from 'antd';
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/shared/IconButton';
import {
  blankQuestion,
  gapNumbers,
  QTYPE_HINT,
  QTYPE_LABEL,
  QTYPES,
  questionError,
  uid,
  type QType,
  type TestQuestion,
} from './elementTypes';
import { Grid2, LANG_LABEL, NumberField, TextField, type Lang } from './fields';
import { ListEditor, moveItem } from './ListEditor';

const plain = (q: TestQuestion, lang: Lang) => (lang === 'ru' ? q.text_ru || q.text_kz : q.text_kz || q.text_ru);

/** Вопросы теста: список, добавление по типу, редактирование одного вопроса (QuestionForm) */
export function TestQuestions({
  questions,
  onChange,
  lang,
}: {
  questions: TestQuestion[];
  onChange: (q: TestQuestion[]) => void;
  lang: Lang;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const total = questions.reduce((n, q) => n + (q.type === 'essay' ? 0 : q.points), 0);

  const add = (type: QType) => {
    const q = blankQuestion(type);
    onChange([...questions, q]);
    setEditing(q.id);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="test-questions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted">
          Вопросов: {questions.length} · баллов: {total}
        </span>
        <Dropdown
          trigger={['click']}
          menu={{
            items: QTYPES.map((t) => ({
              key: t,
              label: (
                <span className="flex flex-col">
                  <span>{QTYPE_LABEL[t]}</span>
                  <span className="text-xs text-muted">{QTYPE_HINT[t]}</span>
                </span>
              ),
            })),
            onClick: ({ key }) => add(key as QType),
          }}
        >
          <Button type="primary" icon={<Plus size={16} />}>
            Добавить вопрос <ChevronDown size={14} />
          </Button>
        </Dropdown>
      </div>

      {!questions.length && <Empty description="Вопросов пока нет. Добавьте первый." />}

      {questions.map((q, i) => {
        const error = questionError(q);
        const open = editing === q.id;
        return (
          <Card
            key={q.id}
            size="small"
            data-testid={`question-${i + 1}`}
            title={
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 font-semibold">Вопрос {i + 1}</span>
                <Tag>{QTYPE_LABEL[q.type]}</Tag>
                {!open && <span className="truncate font-normal text-muted">{plain(q, lang) || 'без текста'}</span>}
              </span>
            }
            extra={
              <span className="flex items-center gap-1">
                {error && !open && <Tag color="error">Не заполнен</Tag>}
                <span className="text-xs text-muted">{q.type === 'essay' ? 'без баллов' : `${q.points} б.`}</span>
                <IconButton type="text" size="small" label="Выше" icon={<ArrowUp size={14} />} disabled={i === 0} onClick={() => onChange(moveItem(questions, i, -1))} />
                <IconButton
                  type="text"
                  size="small"
                  label="Ниже"
                  icon={<ArrowDown size={14} />}
                  disabled={i === questions.length - 1}
                  onClick={() => onChange(moveItem(questions, i, 1))}
                />
                <IconButton
                  type="text"
                  size="small"
                  label={open ? 'Свернуть вопрос' : `Редактировать вопрос ${i + 1}`}
                  icon={<Pencil size={14} />}
                  onClick={() => setEditing(open ? null : q.id)}
                />
                <IconButton
                  type="text"
                  danger
                  size="small"
                  label={`Удалить вопрос ${i + 1}`}
                  icon={<Trash2 size={14} />}
                  onClick={() => onChange(questions.filter((x) => x.id !== q.id))}
                />
              </span>
            }
          >
            {open && (
              <QuestionForm
                q={q}
                lang={lang}
                error={error}
                onChange={(next) => onChange(questions.map((x) => (x.id === q.id ? next : x)))}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}

function QuestionForm({
  q,
  onChange,
  lang,
  error,
}: {
  q: TestQuestion;
  onChange: (q: TestQuestion) => void;
  lang: Lang;
  error: string | null;
}) {
  const set = (patch: Partial<TestQuestion>) => onChange({ ...q, ...patch });
  const textKey = lang === 'ru' ? 'text_ru' : 'text_kz';
  const gapsKey = lang === 'ru' ? 'gaps_ru' : 'gaps_kz';

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert type="warning" showIcon title={error} />}
      {q.type !== 'gaps' && (
        <TextField label={`Вопрос ${LANG_LABEL[lang]}`} multiline rows={2} value={q[textKey]} onChange={(v) => set({ [textKey]: v })} />
      )}

      {(q.type === 'single' || q.type === 'multiple') && (
        <div>
          <p className="m-0 mb-2 text-sm font-medium">Варианты ответа — отметьте {q.type === 'single' ? 'верный' : 'все верные'}</p>
          <ListEditor
            items={q.options}
            onChange={(options) => set({ options })}
            lang={lang}
            mark={q.type}
            min={2}
            max={10}
            reorder
            label={(i) => `Вариант ${i + 1}`}
            addLabel="Добавить вариант"
            make={() => ({ id: uid('o'), ru: '', kz: '', correct: false })}
          />
        </div>
      )}

      {q.type === 'matching' && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-muted">Пишите пары как они должны сойтись. Правую колонку слушатель увидит перемешанной.</p>
          {q.pairs.map((p, i) => {
            const l = lang === 'ru' ? 'left_ru' : 'left_kz';
            const r = lang === 'ru' ? 'right_ru' : 'right_kz';
            const upd = (patch: Partial<typeof p>) => set({ pairs: q.pairs.map((x) => (x.id === p.id ? { ...x, ...patch } : x)) });
            return (
              <div key={p.id} className="flex items-center gap-2">
                <Input aria-label={`Пара ${i + 1}: слева`} placeholder="Левая колонка" value={p[l]} onChange={(e) => upd({ [l]: e.target.value })} />
                <span className="text-muted">→</span>
                <Input aria-label={`Пара ${i + 1}: справа`} placeholder="Правая колонка" value={p[r]} onChange={(e) => upd({ [r]: e.target.value })} />
                <IconButton
                  type="text"
                  danger
                  size="small"
                  label={`Удалить пару ${i + 1}`}
                  icon={<Trash2 size={14} />}
                  disabled={q.pairs.length <= 2}
                  onClick={() => set({ pairs: q.pairs.filter((x) => x.id !== p.id) })}
                />
              </div>
            );
          })}
          <div>
            <Button
              size="small"
              icon={<Plus size={14} />}
              disabled={q.pairs.length >= 12}
              onClick={() => set({ pairs: [...q.pairs, { id: uid('p'), left_ru: '', left_kz: '', right_ru: '', right_kz: '' }] })}
            >
              Добавить пару
            </Button>
          </div>
        </div>
      )}

      {q.type === 'ordering' && (
        <div>
          <p className="m-0 mb-2 text-sm text-muted">Введите пункты в правильном порядке — слушатель увидит их перемешанными.</p>
          <ListEditor
            items={q.items}
            onChange={(items) => set({ items })}
            lang={lang}
            min={2}
            max={12}
            reorder
            label={(i) => `Пункт ${i + 1}`}
            addLabel="Добавить пункт"
            make={() => ({ id: uid('i'), ru: '', kz: '' })}
          />
        </div>
      )}

      {q.type === 'gaps' && (
        <>
          <TextField
            label={`Текст с пропусками ${LANG_LABEL[lang]}`}
            multiline
            rows={4}
            value={q[gapsKey]}
            onChange={(v) => set({ [gapsKey]: v })}
            hint="Пропуск обозначьте [[1]], [[2]]… Для каждого перечислите верные ответы через точку с запятой."
          />
          {gapNumbers(q.gaps_ru || q.gaps_kz).map((n) => (
            <TextField
              key={n}
              label={`Ответы для пропуска ${n}`}
              value={q.gap_answers[n - 1] ?? ''}
              onChange={(v) => {
                const next = [...q.gap_answers];
                next[n - 1] = v;
                set({ gap_answers: next });
              }}
            />
          ))}
        </>
      )}

      {q.type === 'numeric' && (
        <Grid2>
          <NumberField label="Верное число" nullable value={q.numeric_value} step={0.1} onChange={(v) => set({ numeric_value: v })} />
          <NumberField label="Допустимое отклонение" min={0} step={0.1} value={q.numeric_tolerance} onChange={(v) => set({ numeric_tolerance: v ?? 0 })} />
        </Grid2>
      )}

      {q.type === 'short' && (
        <TextField
          label="Верные ответы"
          multiline
          rows={3}
          value={q.short_answers}
          onChange={(v) => set({ short_answers: v })}
          hint="По одному в строке. Регистр, лишние пробелы и «ё» не учитываются."
        />
      )}

      {q.type === 'matrix' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="m-0 mb-2 text-sm font-medium">Столбцы (варианты)</p>
            <ListEditor
              items={q.cols}
              onChange={(cols) => set({ cols, rows: q.rows.map((r) => ({ ...r, correct: Math.min(r.correct, cols.length - 1) })) })}
              lang={lang}
              min={2}
              max={6}
              label={(i) => `Столбец ${i + 1}`}
              addLabel="Добавить столбец"
              make={() => ({ id: uid('k'), ru: '', kz: '' })}
            />
          </div>
          <div>
            <p className="m-0 mb-2 text-sm font-medium">Строки (утверждения) и верный столбец</p>
            <ListEditor
              items={q.rows}
              onChange={(rows) => set({ rows })}
              lang={lang}
              min={1}
              max={20}
              label={(i) => `Строка ${i + 1}`}
              addLabel="Добавить строку"
              make={() => ({ id: uid('m'), ru: '', kz: '', correct: 0 })}
              extra={(row) => (
                <Radio.Group
                  size="small"
                  aria-label="Верный столбец"
                  value={row.correct}
                  onChange={(e) =>
                    set({ rows: q.rows.map((x) => (x.id === row.id ? { ...x, correct: Number(e.target.value) } : x)) })
                  }
                  options={q.cols.map((c, j) => ({ value: j, label: c[lang] || c.ru || `${j + 1}` }))}
                />
              )}
            />
          </div>
        </div>
      )}

      {q.type === 'essay' && (
        <>
          <p className="m-0 text-sm text-muted">
            Слушатель пишет ответ своими словами. Эссе не оценивается баллами: после ответа он видит ваш текст обратной связи.
          </p>
          <TextField
            label={`Обратная связь после ответа ${LANG_LABEL[lang]}`}
            multiline
            rows={3}
            value={lang === 'ru' ? q.essay_feedback_ru : q.essay_feedback_kz}
            onChange={(v) => set(lang === 'ru' ? { essay_feedback_ru: v } : { essay_feedback_kz: v })}
          />
        </>
      )}

      <Grid2>
        {q.type !== 'essay' && (
          <NumberField label="Баллы" min={0} max={100} value={q.points} onChange={(v) => set({ points: v ?? 0 })} />
        )}
        <TextField label="Тема" value={q.topic} onChange={(v) => set({ topic: v })} hint="Для аналитики: какие темы даются труднее" />
      </Grid2>
    </div>
  );
}
