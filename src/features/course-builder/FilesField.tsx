import { App, Button, Select, Tag, Upload } from 'antd';
import { FileText, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useState } from 'react';
import type { ElementFile, ElementType } from '@/api/types';
import { IconButton } from '@/shared/IconButton';
import { fileLangLabel, formatSize, SINGLE_FILE_TYPES, uid, UPLOAD_ACCEPT, UPLOAD_HINT } from './elementTypes';

/** Картинки до 1 МБ сохраняются с превью; остальные файлы — метаданные (мок без файлового хранилища) */
const PREVIEW_LIMIT = 1024 * 1024;
const MAX_SIZE = 1024 * 1024 * 1024;

function readDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/') || file.size > PREVIEW_LIMIT) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

/**
 * Файлы элемента: загрузка нескольких файлов сразу с выбором языка (оба / KZ / RU).
 * У видео, аудио и SCORM основной файл один на язык — новая загрузка заменяет старую.
 */
export function FilesField({
  type,
  files,
  onChange,
  folderId = null,
  folderOptions,
}: {
  type: ElementType;
  files: ElementFile[];
  onChange: (files: ElementFile[]) => void;
  /** Папка, в которую загружать (для элемента «Папка») */
  folderId?: string | null;
  folderOptions?: { value: string; label: string }[];
}) {
  const { message } = App.useApp();
  const [lang, setLang] = useState<ElementFile['lang']>('');
  const single = SINGLE_FILE_TYPES.includes(type);
  const visible = folderOptions ? files.filter((f) => f.folderId === folderId) : files;

  const add = async (list: File[]) => {
    const tooBig = list.filter((f) => f.size > MAX_SIZE);
    if (tooBig.length) message.error(`Файл «${tooBig[0]!.name}» больше 1 ГБ`);
    const accepted = list.filter((f) => f.size <= MAX_SIZE);
    if (!accepted.length) return;
    const added: ElementFile[] = await Promise.all(
      (single ? accepted.slice(0, 1) : accepted).map(async (f) => ({
        id: uid('f'),
        name: f.name,
        size: f.size,
        mime: f.type || 'application/octet-stream',
        lang,
        folderId,
        dataUrl: await readDataUrl(f),
        uploadedAt: new Date().toISOString(),
      })),
    );
    // один основной файл на язык: файл «для обоих» заменяет все, языковой — свой и общий
    const kept = single ? files.filter((f) => lang !== '' && f.lang !== '' && f.lang !== lang) : files;
    onChange([...kept, ...added]);
    message.success(added.length > 1 ? `Загружено файлов: ${added.length}` : 'Файл загружен');
  };

  return (
    <div className="flex flex-col gap-3" data-testid="element-files">
      <div className="flex flex-wrap items-center gap-2">
        <Upload
          multiple={!single}
          accept={UPLOAD_ACCEPT[type]}
          showUploadList={false}
          beforeUpload={(file, list) => {
            // antd вызывает beforeUpload для каждого файла — обрабатываем пачку один раз
            if (file === list[0]) void add(list);
            return false;
          }}
        >
          <Button icon={<UploadIcon size={16} />}>{single ? 'Загрузить файл' : 'Загрузить файлы'}</Button>
        </Upload>
        <Select<ElementFile['lang']>
          aria-label="Язык файла"
          value={lang}
          onChange={setLang}
          style={{ width: 150 }}
          options={[
            { value: '', label: 'Оба языка' },
            { value: 'kz', label: 'Казахский' },
            { value: 'ru', label: 'Русский' },
          ]}
        />
        {UPLOAD_HINT[type] && <span className="text-xs text-muted">{UPLOAD_HINT[type]}</span>}
      </div>
      {visible.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {visible.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              {f.dataUrl ? (
                <img src={f.dataUrl} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <FileText size={20} className="shrink-0 text-muted" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{f.name}</span>
                <span className="text-xs text-muted">{formatSize(f.size)}</span>
              </span>
              <Tag>{fileLangLabel(f)}</Tag>
              {folderOptions && (
                <Select<string>
                  aria-label={`Переместить «${f.name}» в папку`}
                  size="small"
                  style={{ width: 160 }}
                  value={f.folderId ?? ''}
                  onChange={(v) => onChange(files.map((x) => (x.id === f.id ? { ...x, folderId: v || null } : x)))}
                  options={[{ value: '', label: 'Корень' }, ...folderOptions]}
                />
              )}
              <IconButton
                type="text"
                danger
                label={`Удалить файл «${f.name}»`}
                icon={<Trash2 size={16} />}
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-muted">Файлы ещё не загружены.</p>
      )}
    </div>
  );
}
