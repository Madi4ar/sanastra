import { Alert, Button, Checkbox, Collapse, Empty, Image, Input, InputNumber, Modal, Radio, Rate, Segmented, Select, Tag } from 'antd';
import { Download, ExternalLink, FileText, Folder } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { CourseElement, ElementFile } from '@/api/types';
import { formatDate } from '@/shared/format';
import { ElementIcon } from './ElementEditor';
import {
  ANSWER_LABEL,
  COUNTED_LABEL,
  CUTOFF_LABEL,
  DEADLINE_LABEL,
  ELEMENT_LABEL,
  EVENT_LABEL,
  fileLangLabel,
  formatSize,
  formatTime,
  QTYPE_LABEL,
  TEST_KIND_LABEL,
  TONE_LABEL,
  type AssignmentSettings,
  type AudioSettings,
  type FileViewSettings,
  type FolderSettings,
  type ImageSettings,
  type InteractiveVideoSettings,
  type LinkSettings,
  type LongreadSettings,
  type ReflectionSettings,
  type ScormSettings,
  type SurveySettings,
  type TableSettings,
  type TestQuestion,
  type TestSettings,
  type VideoSettings,
  type WorkSettings,
} from './elementTypes';
import type { Lang } from './fields';

/** Текст на выбранном языке с запасным вариантом на другом */
const pick = (ru: string | null | undefined, kz: string | null | undefined, lang: Lang) =>
  (lang === 'ru' ? ru || kz : kz || ru) ?? '';

function embedUrl(url: string): string | null {
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = /vimeo\.com\/(\d+)/.exec(url);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const kin = /kinescope\.io\/(?:embed\/)?([\w-]+)/.exec(url);
  if (kin) return `https://kinescope.io/embed/${kin[1]}`;
  return null;
}

function Embed({ url, title }: { url: string; title: string }) {
  const src = embedUrl(url);
  if (!src)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
        {url} <ExternalLink size={14} aria-hidden />
      </a>
    );
  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe src={src} title={title} className="h-full w-full border-0" allow="fullscreen; picture-in-picture" allowFullScreen />
    </div>
  );
}

function filesFor(files: ElementFile[], lang: Lang) {
  return files.filter((f) => f.lang === '' || f.lang === lang);
}

function FileList({ files, downloadable = true }: { files: ElementFile[]; downloadable?: boolean }) {
  if (!files.length) return <Empty description="Файлы ещё не загружены" />;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {files.map((f) => (
        <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
          <FileText size={18} className="text-muted" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
          <span className="text-xs text-muted">{formatSize(f.size)}</span>
          <Tag>{fileLangLabel(f)}</Tag>
          {downloadable && (
            <Button size="small" icon={<Download size={14} />} disabled>
              Скачать
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

const Note = ({ children }: { children: ReactNode }) => <p className="m-0 text-xs text-muted">{children}</p>;
const Para = ({ text }: { text: string }) => (text ? <p className="m-0 whitespace-pre-line">{text}</p> : null);

function VideoView({ s, files, lang, title }: { s: VideoSettings; files: ElementFile[]; lang: Lang; title: string }) {
  const own = filesFor(files, lang);
  return (
    <div className="flex flex-col gap-3">
      {s.source === 'url' && s.url ? (
        <Embed url={s.url} title={title} />
      ) : own.length ? (
        <div className="flex aspect-video items-center justify-center rounded-lg bg-black text-white">▶ {own[0]!.name}</div>
      ) : (
        <Empty description="Видео ещё не добавлено" />
      )}
      <Para text={pick(s.note_ru, s.note_kz, lang)} />
      <Note>
        {s.duration_min ? `${s.duration_min} мин · ` : ''}засчитывается после просмотра {s.watch_percent}%
        {s.no_seek_first ? ' · перемотка вперёд при первом просмотре недоступна' : ''}
      </Note>
    </div>
  );
}

function TestQuestionView({ q, lang, n }: { q: TestQuestion; lang: Lang; n: number }) {
  const text = pick(q.text_ru, q.text_kz, lang);
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="m-0 mb-1 text-xs text-muted">
        Вопрос {n} · {QTYPE_LABEL[q.type]}
        {q.type !== 'essay' ? ` · ${q.points} б.` : ''}
      </p>
      {q.type !== 'gaps' && <p className="m-0 mb-3 font-medium whitespace-pre-line">{text}</p>}
      {q.type === 'single' && <Radio.Group className="flex flex-col gap-1" options={q.options.map((o) => ({ value: o.id, label: pick(o.ru, o.kz, lang) }))} />}
      {q.type === 'multiple' && <Checkbox.Group className="flex flex-col gap-1" options={q.options.map((o) => ({ value: o.id, label: pick(o.ru, o.kz, lang) }))} />}
      {q.type === 'matching' && (
        <div className="flex flex-col gap-2">
          {q.pairs.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="flex-1">{pick(p.left_ru, p.left_kz, lang)}</span>
              <Select
                aria-label="Соответствие"
                style={{ width: 220 }}
                placeholder="Выберите"
                options={[...q.pairs].reverse().map((x) => ({ value: x.id, label: pick(x.right_ru, x.right_kz, lang) }))}
              />
            </div>
          ))}
        </div>
      )}
      {q.type === 'ordering' && (
        <ol className="m-0 flex flex-col gap-1 pl-5">
          {[...q.items].reverse().map((i) => (
            <li key={i.id}>{pick(i.ru, i.kz, lang)}</li>
          ))}
        </ol>
      )}
      {q.type === 'gaps' && (
        <p className="m-0 leading-8">
          {pick(q.gaps_ru, q.gaps_kz, lang)
            .split(/(\[\[\d{1,2}\]\])/)
            .map((part, i) =>
              /^\[\[\d{1,2}\]\]$/.test(part) ? <Input key={i} size="small" aria-label="Пропуск" style={{ width: 120 }} /> : <span key={i}>{part}</span>,
            )}
        </p>
      )}
      {q.type === 'numeric' && <InputNumber aria-label="Ответ" placeholder="Число" />}
      {q.type === 'short' && <Input aria-label="Ответ" placeholder="Ваш ответ" />}
      {q.type === 'matrix' && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th />
              {q.cols.map((c) => (
                <th key={c.id} className="p-1 font-medium">
                  {pick(c.ru, c.kz, lang)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-1">{pick(r.ru, r.kz, lang)}</td>
                {q.cols.map((c) => (
                  <td key={c.id} className="p-1 text-center">
                    <input type="radio" name={r.id} aria-label={pick(c.ru, c.kz, lang)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {q.type === 'essay' && <Input.TextArea aria-label="Ответ" rows={4} placeholder="Ответ своими словами" />}
    </div>
  );
}

function WorkInfo({ s }: { s: WorkSettings }) {
  return (
    <Note>
      Срок: {DEADLINE_LABEL[s.deadline].toLowerCase()}
      {s.deadline === 'date' && s.due_date ? ` ${formatDate(s.due_date)}` : ''} · после срока: {CUTOFF_LABEL[s.cutoff].toLowerCase()}
      {s.graded ? ` · максимум ${s.max_score} б., проходной ${s.pass_score} б.` : ' · без оценки'}
      {s.allow_resubmit ? ` · до ${s.max_rounds} сдач` : ''}
    </Note>
  );
}

function Body({ el, lang }: { el: CourseElement; lang: Lang }) {
  const title = pick(el.titleRu, el.titleKz, lang);
  switch (el.type) {
    case 'video':
      return <VideoView s={el.settings as unknown as VideoSettings} files={el.files} lang={lang} title={title} />;
    case 'interactive_video': {
      const s = el.settings as unknown as InteractiveVideoSettings;
      return (
        <div className="flex flex-col gap-4">
          <VideoView s={s} files={el.files} lang={lang} title={title} />
          {s.events.length > 0 && (
            <div>
              <p className="m-0 mb-2 text-sm font-medium">События в видео</p>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {[...s.events]
                  .sort((a, b) => a.at - b.at)
                  .map((ev) => (
                    <li key={ev.id} className="flex items-center gap-2 text-sm">
                      <Tag className="mono">{formatTime(ev.at)}</Tag>
                      <span className="text-muted">{EVENT_LABEL[ev.kind]}:</span>
                      <span>{pick(ev.kind === 'chapter' ? ev.title_ru : ev.text_ru, ev.kind === 'chapter' ? ev.title_kz : ev.text_kz, lang) || '—'}</span>
                    </li>
                  ))}
              </ul>
              <Note>Проходной балл по вопросам в видео — {s.pass_percent}%</Note>
            </div>
          )}
        </div>
      );
    }
    case 'text': {
      const s = el.settings as unknown as LongreadSettings;
      const headings = s.blocks.filter((b) => b.kind === 'heading');
      const readMin = lang === 'ru' ? s.read_min_ru : s.read_min_kz;
      if (!s.blocks.length) return <Empty description="Лонгрид пока пуст" />;
      return (
        <article className="flex flex-col gap-4">
          {readMin && <Note>Время чтения — {readMin} мин</Note>}
          {s.auto_toc && headings.length > 1 && (
            <nav aria-label="Оглавление" className="rounded-lg bg-subtle p-3 text-sm">
              <p className="m-0 mb-1 font-medium">Оглавление</p>
              <ol className="m-0 pl-5">
                {headings.map((h) => (
                  <li key={h.id}>{pick(h.text_ru, h.text_kz, lang)}</li>
                ))}
              </ol>
            </nav>
          )}
          {s.blocks.map((b) => {
            const text = pick(b.text_ru, b.text_kz, lang);
            const head = pick(b.title_ru, b.title_kz, lang);
            const file = el.files.find((f) => f.id === b.file_id);
            switch (b.kind) {
              case 'heading':
                return <h3 key={b.id} className="m-0 text-lg font-semibold">{text}</h3>;
              case 'paragraph':
                return <Para key={b.id} text={text} />;
              case 'list':
                return (
                  <ul key={b.id} className="m-0 pl-5">
                    {text.split('\n').filter(Boolean).map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                );
              case 'quote':
                return <blockquote key={b.id} className="m-0 border-l-4 border-border pl-4 italic">{text}</blockquote>;
              case 'callout':
                return (
                  <Alert key={b.id} type={b.tone === 'warning' ? 'warning' : b.tone === 'tip' ? 'success' : 'info'} showIcon title={head || TONE_LABEL[b.tone]} description={<Para text={text} />} />
                );
              case 'accordion':
                return <Collapse key={b.id} items={[{ key: b.id, label: head || 'Подробнее', children: <Para text={text} /> }]} />;
              case 'embed':
                return b.url ? (
                  <figure key={b.id} className="m-0">
                    <Embed url={b.url} title={head || title} />
                    {head && <figcaption className="mt-1 text-xs text-muted">{head}</figcaption>}
                  </figure>
                ) : null;
              case 'image':
                return file?.dataUrl ? (
                  <figure key={b.id} className="m-0">
                    <Image src={file.dataUrl} alt={head} />
                    {head && <figcaption className="mt-1 text-xs text-muted">{head}</figcaption>}
                  </figure>
                ) : null;
              case 'file':
                return file ? <FileList key={b.id} files={[file]} /> : null;
              case 'table': {
                const rows = text.split('\n').filter(Boolean).map((r) => r.split('|').map((c) => c.trim()));
                return (
                  <div key={b.id} className="overflow-x-auto">
                    {head && <p className="m-0 mb-1 text-sm font-medium">{head}</p>}
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={i}>
                            {r.map((c, j) => (
                              <td key={j} className={`border border-border p-2 ${i === 0 ? 'bg-subtle font-medium' : ''}`}>
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }
            }
          })}
          {s.confirm_read && (
            <div>
              <Button type="primary">Ознакомлен</Button>
            </div>
          )}
        </article>
      );
    }
    case 'audio': {
      const s = el.settings as unknown as AudioSettings;
      const transcript = pick(s.transcript_ru, s.transcript_kz, lang);
      return (
        <div className="flex flex-col gap-3">
          <FileList files={filesFor(el.files, lang)} downloadable={false} />
          {s.duration_min && <Note>{s.duration_min} мин</Note>}
          {transcript && <Collapse items={[{ key: 't', label: 'Расшифровка', children: <Para text={transcript} /> }]} />}
        </div>
      );
    }
    case 'document':
    case 'presentation': {
      const s = el.settings as unknown as FileViewSettings;
      return (
        <div className="flex flex-col gap-3">
          <FileList files={filesFor(el.files, lang)} downloadable={s.downloadable} />
          {s.preview && <Note>Файл открывается прямо на странице (PDF).</Note>}
        </div>
      );
    }
    case 'folder':
      return <FolderView s={el.settings as unknown as FolderSettings} files={filesFor(el.files, lang)} lang={lang} />;
    case 'image': {
      const s = el.settings as unknown as ImageSettings;
      const img = filesFor(el.files, lang).find((f) => f.dataUrl);
      const caption = pick(s.caption_ru, s.caption_kz, lang);
      return img ? (
        <figure className="m-0">
          <Image src={img.dataUrl} alt={caption || title} preview={s.zoom} />
          {caption && <figcaption className="mt-1 text-sm text-muted">{caption}</figcaption>}
        </figure>
      ) : el.files.length ? (
        <FileList files={el.files} downloadable={false} />
      ) : (
        <Empty description="Картинка ещё не загружена" />
      );
    }
    case 'link': {
      const s = el.settings as unknown as LinkSettings;
      const url = (lang === 'ru' ? s.url_ru || s.url : s.url || s.url_ru) ?? '';
      return (
        <div className="flex flex-col gap-3">
          <Para text={pick(s.note_ru, s.note_kz, lang)} />
          {url ? (
            s.embed && embedUrl(url) ? (
              <Embed url={url} title={title} />
            ) : (
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1">
                Открыть ресурс <ExternalLink size={14} aria-hidden />
              </a>
            )
          ) : (
            <Empty description="Ссылка не указана" />
          )}
        </div>
      );
    }
    case 'scorm': {
      const s = el.settings as unknown as ScormSettings;
      return (
        <div className="flex flex-col gap-3">
          <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-border text-muted">
            {filesFor(el.files, lang).length ? `SCORM ${s.version}: ${filesFor(el.files, lang)[0]!.name}` : 'Пакет ещё не загружен'}
          </div>
          <Note>
            {s.display === 'embedded' ? 'Открывается внутри страницы' : 'Открывается в новом окне'} · попыток:{' '}
            {s.max_attempts ?? 'без ограничений'}
            {s.pass_score !== null ? ` · проходной балл ${s.pass_score}%` : ''}
          </Note>
        </div>
      );
    }
    case 'assignment': {
      const s = el.settings as unknown as AssignmentSettings;
      return (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm font-medium">Задание</p>
          <Para text={pick(s.task_ru, s.task_kz, lang) || '—'} />
          {pick(s.criteria_ru, s.criteria_kz, lang) && (
            <Collapse items={[{ key: 'c', label: 'Критерии оценки', children: <Para text={pick(s.criteria_ru, s.criteria_kz, lang)} /> }]} />
          )}
          {s.answer !== 'file' && <Input.TextArea aria-label="Ответ" rows={4} placeholder="Ваш ответ" />}
          {s.answer !== 'text' && (
            <Note>
              Файлы: до {s.max_files} шт., до {s.max_size_mb} МБ каждый · {ANSWER_LABEL[s.answer].toLowerCase()}
            </Note>
          )}
          <WorkInfo s={s} />
          <div>
            <Button type="primary">Отправить на проверку</Button>
          </div>
        </div>
      );
    }
    case 'table': {
      const s = el.settings as unknown as TableSettings;
      return (
        <div className="flex flex-col gap-3">
          <Para text={pick(s.task_ru, s.task_kz, lang)} />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <tbody>
                {s.table.rows.map((r, i) => (
                  <tr key={r.id}>
                    {r.cells.map((c, j) => {
                      const header = (s.table.header_row && i === 0) || (s.table.header_col && j === 0);
                      return (
                        <td key={c.id} className={`border border-border p-2 align-top ${header ? 'bg-subtle font-medium' : ''}`}>
                          {c.input ? (
                            <Input.TextArea aria-label={`Ответ: строка ${i + 1}, столбец ${j + 1}`} autoSize placeholder={pick(c.ru, c.kz, lang)} />
                          ) : (
                            pick(c.ru, c.kz, lang)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <WorkInfo s={s} />
          <div>
            <Button type="primary">Отправить на проверку</Button>
          </div>
        </div>
      );
    }
    case 'test': {
      const s = el.settings as unknown as TestSettings;
      return (
        <div className="flex flex-col gap-3">
          <Note>
            {TEST_KIND_LABEL[s.kind]} тест · вопросов: {s.pick_count ?? s.questions.length} · проходной балл {s.pass_percent}% · попыток:{' '}
            {s.attempts ?? 'без ограничений'}
            {s.time_limit ? ` · ${s.time_limit} мин на попытку` : ''} · в зачёт: {COUNTED_LABEL[s.counted].toLowerCase()}
          </Note>
          {s.questions.length ? (
            s.questions.map((q, i) => <TestQuestionView key={q.id} q={q} n={i + 1} lang={lang} />)
          ) : (
            <Empty description="В тесте пока нет вопросов" />
          )}
          <div>
            <Button type="primary" disabled={!s.questions.length}>
              Завершить тест
            </Button>
          </div>
        </div>
      );
    }
    case 'survey': {
      const s = el.settings as unknown as SurveySettings;
      if (!s.questions.length) return <Empty description="В анкете пока нет вопросов" />;
      return (
        <div className="flex flex-col gap-4">
          {s.anonymous && <Note>Анонимная анкета</Note>}
          {s.questions.map((q, i) => (
            <div key={q.id}>
              <p className="m-0 mb-2 font-medium">
                {i + 1}. {pick(q.ru, q.kz, lang)} {q.required && <span className="text-error">*</span>}
              </p>
              {q.kind === 'text' && <Input.TextArea aria-label={pick(q.ru, q.kz, lang)} rows={3} />}
              {q.kind === 'single' && <Radio.Group className="flex flex-col gap-1" options={q.options.map((o) => ({ value: o.id, label: pick(o.ru, o.kz, lang) }))} />}
              {q.kind === 'multiple' && <Checkbox.Group className="flex flex-col gap-1" options={q.options.map((o) => ({ value: o.id, label: pick(o.ru, o.kz, lang) }))} />}
              {q.kind === 'scale' && <Rate aria-label={pick(q.ru, q.kz, lang)} />}
            </div>
          ))}
          <div>
            <Button type="primary">Отправить ответы</Button>
          </div>
        </div>
      );
    }
    case 'reflection': {
      const s = el.settings as unknown as ReflectionSettings;
      return (
        <div className="flex flex-col gap-3">
          <p className="m-0 font-medium whitespace-pre-line">{pick(s.question_ru, s.question_kz, lang) || '—'}</p>
          <Input.TextArea aria-label="Ответ" rows={4} maxLength={s.limit} showCount />
          <div>
            <Button type="primary">Ответить</Button>
          </div>
        </div>
      );
    }
  }
}

function FolderView({ s, files, lang }: { s: FolderSettings; files: ElementFile[]; lang: Lang }) {
  const [current, setCurrent] = useState<string | null>(null);
  const folder = s.folders.find((f) => f.id === current);
  const folders = s.folders.filter((f) => f.parentId === current);
  const own = files.filter((f) => f.folderId === current);
  return (
    <div className="flex flex-col gap-2">
      {folder && (
        <div>
          <Button size="small" type="link" className="px-0" onClick={() => setCurrent(folder.parentId)}>
            ← Назад
          </Button>
        </div>
      )}
      {folders.map((f) => (
        <button
          key={f.id}
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-transparent px-3 py-2 text-left"
          onClick={() => setCurrent(f.id)}
        >
          <Folder size={18} className="text-warning" aria-hidden /> {pick(f.title_ru, f.title_kz, lang) || 'Папка'}
        </button>
      ))}
      {own.length > 0 && <FileList files={own} downloadable={s.downloadable} />}
      {!folders.length && !own.length && <Empty description="Папка пуста" />}
    </div>
  );
}

/** Просмотр элемента так, как его видит слушатель */
export function ElementPreview({ element, onClose }: { element: CourseElement; onClose: () => void }) {
  const [lang, setLang] = useState<Lang>('ru');
  return (
    <Modal
      open
      width={820}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      title={
        <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
          <span className="flex items-center gap-2">
            <ElementIcon type={element.type} />
            {pick(element.titleRu, element.titleKz, lang)}
          </span>
          <Segmented<Lang>
            size="small"
            aria-label="Язык просмотра"
            value={lang}
            onChange={setLang}
            options={[
              { value: 'kz', label: 'KZ' },
              { value: 'ru', label: 'RU' },
            ]}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2" data-testid="element-preview">
        <div className="flex flex-wrap gap-2">
          <Tag>{ELEMENT_LABEL[element.type]}</Tag>
          {element.required && <Tag color="blue">Обязательный</Tag>}
          {element.hidden && <Tag>Скрыт от слушателей</Tag>}
        </div>
        <Body el={element} lang={lang} />
      </div>
    </Modal>
  );
}
