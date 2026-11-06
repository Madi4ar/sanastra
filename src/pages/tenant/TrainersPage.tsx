import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Modal, Segmented, Select, Switch, Table, Tag } from 'antd';
import { Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrgTrainer, TrainerCandidate } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { formatPhone } from '@/features/auth/validation';
import { useDirectoryOptions } from '@/features/directories/useDirectoryOptions';
import { useCabinet } from '@/features/tenant/cabinet';
import { Field } from '@/shared/FormField';
import { formatDate } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { useDebouncedValue } from '@/shared/useDebouncedValue';
import { PageHeader } from './PageHeader';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** «Добавить тренера»: поиск по общей базе и подтверждение привязки к организации */
function AddTrainerModal({ canRegister, onClose }: { canRegister: boolean; onClose: () => void }) {
  const { clientSlug, base } = useCabinet();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<TrainerCandidate | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categories = useDirectoryOptions(clientSlug, 'trainer_category');
  const q = useDebouncedValue(query.trim(), 300);
  const ready = q.length >= 3;
  const search = useQuery({
    queryKey: queryKeys.tenantAdmin(clientSlug, `trainer-search:${q}`),
    queryFn: () => admin.searchTrainers(q),
    enabled: ready,
  });
  const add = useMutation({
    mutationFn: () => admin.addTrainer(picked!.userId, categoryId),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      message.success(`Добавлено в тренерский состав: ${t.fullName}`);
      onClose();
    },
  });
  // Текущий текст поля, а не значение после debounce: кнопку могут нажать сразу после ввода
  const digits = /^\d{12}$/.test(query.trim()) ? query.trim() : '';

  return (
    <Modal
      open
      width={600}
      title={picked ? 'Подтвердите привязку' : 'Добавить тренера'}
      onCancel={onClose}
      destroyOnHidden
      footer={
        picked
          ? [
              <Button key="back" disabled={add.isPending} onClick={() => setPicked(null)}>
                Назад
              </Button>,
              <Button key="ok" type="primary" loading={add.isPending} onClick={() => add.mutate()}>
                Подтвердить привязку
              </Button>,
            ]
          : null
      }
    >
      {picked ? (
        <div className="flex flex-col gap-3 pt-2" data-testid="trainer-confirm">
          <p className="m-0">
            <span className="font-semibold">{picked.fullName}</span> <span className="mono text-muted">{picked.iin}</span>
          </p>
          <p className="m-0 text-sm text-muted">
            Новый пользователь не создаётся: у этой учётной записи появится роль тренера в вашей организации, а личный кабинет
            Слушателя сохранится.
          </p>
          <Field label="Категория тренера" htmlFor="trainer-category">
            <Select
              id="trainer-category"
              aria-label="Категория тренера"
              allowClear
              style={{ width: '100%' }}
              placeholder="Не указана"
              value={categoryId ?? undefined}
              options={categories.data ?? []}
              onChange={(v) => setCategoryId(v ?? null)}
            />
          </Field>
          {add.isError && <Alert type="error" showIcon title={add.error.message} />}
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-2" data-testid="trainer-search">
          <Field label="ИИН или ФИО сотрудника" htmlFor="trainer-query" hint="Поиск по общей базе платформы, от 3 символов.">
            <Input
              id="trainer-query"
              autoFocus
              allowClear
              prefix={<Search size={14} className="text-muted" aria-hidden />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          {search.isError && <ErrorState error={search.error} onRetry={() => void search.refetch()} />}
          {ready && search.data?.length === 0 && (
            <Alert
              type="info"
              showIcon
              title="Пользователь не найден в системе"
              description="Сначала зарегистрируйте его через раздел «Пользователи», он сразу появится в тренерском составе."
              action={
                canRegister && (
                  <Button
                    size="small"
                    onClick={() => navigate(`${base}/m/USERS?register=trainer${digits ? `&iin=${digits}` : ''}`)}
                  >
                    Зарегистрировать
                  </Button>
                )
              }
            />
          )}
          {ready && Boolean(search.data?.length) && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {search.data!.map((c) => (
                <li key={c.userId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.fullName}</span>
                    <span className="mono text-xs text-muted">{c.iin}</span>
                  </span>
                  {c.alreadyTrainer ? (
                    <Tag className="m-0">Уже в составе</Tag>
                  ) : (
                    <Button size="small" onClick={() => setPicked(c)}>
                      Выбрать
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

/** Раздел «Тренерский состав»: пул тренеров организации из общей базы пользователей */
export function TrainersPage() {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const access = user?.access ?? [];
  const canToggle = access.includes('lms_trainers.deactivate');
  const q = useQuery({ queryKey: queryKeys.tenantAdmin(clientSlug, 'trainers'), queryFn: () => api.tenantAdmin(clientSlug).trainers() });
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [categoryId, setCategoryId] = useState<string>();
  const categories = useDirectoryOptions(clientSlug, 'trainer_category');
  const text = search.trim().toLowerCase();
  const trainers = q.data ?? [];
  const visible = trainers
    .filter((t) => !text || [t.fullName, t.iin, t.email, t.phone].some((v) => v.toLowerCase().includes(text)))
    .filter((t) => status === 'ALL' || t.active === (status === 'ACTIVE'))
    .filter((t) => !categoryId || t.categoryId === categoryId);
  const filtered = Boolean(text) || status !== 'ALL' || Boolean(categoryId);

  const toggle = useMutation({
    mutationFn: ({ t, active }: { t: OrgTrainer; active: boolean }) => api.tenantAdmin(clientSlug).setTrainerActive(t.id, active),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'trainers') });
      message.success(t.active ? 'Тренер активирован' : 'Тренер деактивирован');
    },
    onError: (e) => message.error(e.message),
  });

  const onToggle = (t: OrgTrainer, active: boolean) => {
    if (active) {
      toggle.mutate({ t, active });
      return;
    }
    modal.confirm({
      title: `Деактивировать ${t.fullName}?`,
      content: 'Доступ к интерфейсу тренера, проверке заданий и ведению групп закроется сразу. Учётная запись и личный кабинет останутся.',
      okText: 'Деактивировать',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => toggle.mutate({ t, active }),
    });
  };

  return (
    <>
      <PageHeader
        title="Тренерский состав"
        subtitle="Преподаватели и эксперты вашей организации из общей базы пользователей платформы."
        extra={
          access.includes('lms_trainers.create') && (
            <Button type="primary" icon={<UserPlus size={16} />} onClick={() => setAdding(true)}>
              Добавить тренера
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Card styles={{ body: { padding: 0 } }} data-testid="trainers">
          <div className="flex flex-wrap items-center gap-3 p-4" data-testid="trainers-filters">
            <Input
              allowClear
              aria-label="Поиск тренера"
              placeholder="Поиск по ФИО, ИИН, Email или телефону"
              prefix={<Search size={14} className="text-muted" aria-hidden />}
              style={{ maxWidth: 340 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Segmented<StatusFilter>
              aria-label="Статус"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'ALL', label: 'Все' },
                { value: 'ACTIVE', label: 'Активен' },
                { value: 'INACTIVE', label: 'Деактивирован' },
              ]}
            />
            <Select
              aria-label="Фильтр по категории тренера"
              allowClear
              placeholder="Все категории"
              style={{ minWidth: 200 }}
              value={categoryId}
              options={categories.data ?? []}
              onChange={setCategoryId}
            />
            {filtered && (
              <Button
                type="link"
                className="px-0"
                onClick={() => {
                  setSearch('');
                  setStatus('ALL');
                  setCategoryId(undefined);
                }}
              >
                Сбросить
              </Button>
            )}
            <span className="ml-auto text-sm text-muted" data-testid="trainers-count">
              Показано: {visible.length} из {trainers.length}
            </span>
          </div>
          <Table<OrgTrainer>
            rowKey="id"
            loading={q.isPending}
            dataSource={visible}
            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 960 }}
            locale={{ emptyText: filtered ? 'Никого не найдено, измените фильтры' : 'Тренеров пока нет' }}
            onRow={(t) => ({ 'data-testid': `trainer-${t.iin}` }) as React.HTMLAttributes<HTMLElement>}
            columns={[
              {
                title: 'ФИО',
                key: 'name',
                render: (_, t) => (
                  <div>
                    <div className="font-medium">{t.fullName}</div>
                    {t.categoryName && <div className="text-xs text-muted">{t.categoryName}</div>}
                  </div>
                ),
              },
              { title: 'ИИН', dataIndex: 'iin', key: 'iin', width: 140, render: (v: string) => <span className="mono">{v}</span> },
              { title: 'Email', dataIndex: 'email', key: 'email' },
              { title: 'Телефон', key: 'phone', width: 170, render: (_, t) => formatPhone(t.phone) },
              {
                title: 'Статус',
                key: 'status',
                width: 200,
                render: (_, t) => (
                  <span className="inline-flex items-center gap-2">
                    {canToggle && (
                      <Switch size="small" checked={t.active} aria-label={`Статус: ${t.fullName}`} onChange={(v) => onToggle(t, v)} />
                    )}
                    {t.active ? <Tag color="green" className="m-0">Активен</Tag> : <Tag className="m-0">Деактивирован</Tag>}
                  </span>
                ),
              },
              { title: 'Дата назначения', key: 'assignedAt', width: 150, render: (_, t) => formatDate(t.assignedAt) },
            ]}
          />
        </Card>
      )}
      {adding && <AddTrainerModal canRegister={access.includes('lms_users.create')} onClose={() => setAdding(false)} />}
    </>
  );
}
