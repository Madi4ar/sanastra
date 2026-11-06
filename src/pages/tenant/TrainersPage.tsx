import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Input, Modal, Switch, Table, Tag } from 'antd';
import { Pencil, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { isApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrgTrainer, TrainerCandidate } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { formatPhone } from '@/features/auth/validation';
import { useCabinet } from '@/features/tenant/cabinet';
import { Field } from '@/shared/FormField';
import { formatDate } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { ErrorState } from '@/shared/PageState';
import { useDebouncedValue } from '@/shared/useDebouncedValue';
import { PageHeader } from './PageHeader';

/** «Добавить тренера»: поиск по общей базе и подтверждение привязки к организации */
function AddTrainerModal({ canRegister, onClose }: { canRegister: boolean; onClose: () => void }) {
  const { clientSlug, base } = useCabinet();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<TrainerCandidate | null>(null);
  const q = useDebouncedValue(query.trim(), 300);
  const ready = q.length >= 3;
  const search = useQuery({
    queryKey: queryKeys.tenantAdmin(clientSlug, `trainer-search:${q}`),
    queryFn: () => admin.searchTrainers(q),
    enabled: ready,
  });
  const add = useMutation({
    mutationFn: () => admin.addTrainer(picked!.userId),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: ['tenant-admin', clientSlug] });
      void qc.invalidateQueries({ queryKey: queryKeys.tenantUsage(clientSlug) });
      message.success(`${t.fullName} добавлен в тренерский состав`);
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

function EditTrainerModal({ trainer, onClose }: { trainer: OrgTrainer; onClose: () => void }) {
  const { clientSlug } = useCabinet();
  const qc = useQueryClient();
  const [specialization, setSpecialization] = useState(trainer.specialization);
  const save = useMutation({
    mutationFn: () => api.tenantAdmin(clientSlug).updateTrainer(trainer.id, specialization),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tenantAdmin(clientSlug, 'trainers') });
      onClose();
    },
  });
  const fe = isApiError(save.error) ? save.error.fieldErrors : {};
  return (
    <Modal
      open
      title={`Редактирование: ${trainer.fullName}`}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="pt-2">
        <Field
          label="Специализация"
          htmlFor="trainer-specialization"
          error={fe.specialization}
          hint="Видна только в вашей организации. ФИО и контакты человек меняет в своём профиле."
        >
          <Input id="trainer-specialization" maxLength={200} value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
        </Field>
      </div>
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
  const [editing, setEditing] = useState<OrgTrainer | null>(null);

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
          <Table<OrgTrainer>
            rowKey="id"
            loading={q.isPending}
            dataSource={q.data}
            pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
            scroll={{ x: 960 }}
            locale={{ emptyText: 'Тренеров пока нет' }}
            onRow={(t) => ({ 'data-testid': `trainer-${t.iin}` }) as React.HTMLAttributes<HTMLElement>}
            columns={[
              {
                title: 'ФИО',
                key: 'name',
                render: (_, t) => (
                  <div>
                    <div className="font-medium">{t.fullName}</div>
                    {t.specialization && <div className="text-xs text-muted">{t.specialization}</div>}
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
              ...(access.includes('lms_trainers.edit')
                ? [
                    {
                      title: '',
                      key: 'actions',
                      width: 56,
                      render: (_: unknown, t: OrgTrainer) => (
                        <IconButton type="text" label={`Редактировать: ${t.fullName}`} icon={<Pencil size={16} />} onClick={() => setEditing(t)} />
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </Card>
      )}
      {adding && <AddTrainerModal canRegister={access.includes('lms_users.create')} onClose={() => setAdding(false)} />}
      {editing && <EditTrainerModal trainer={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
