import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card, DatePicker, Input, Select, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { AuditChange, AuditEntry, AuditEvent, AuditFilters, AuditModule } from '@/api/types';
import { formatDateTimeSeconds } from '@/shared/format';
import { ErrorState } from '@/shared/PageState';
import { useDebouncedValue } from '@/shared/useDebouncedValue';

const MODULE_LABEL: Record<AuditModule, string> = {
  ROLES: 'Управление ролями',
  DEPARTMENTS: 'Отделы',
  USERS: 'Пользователи',
  DIRECTORIES: 'Справочники',
  PROGRAMS: 'Учебные программы',
  GROUPS: 'Учебные группы',
  TRAINERS: 'Тренерский состав',
  SHOWCASE: 'Заявки из витрины',
  PROFILE_FIELDS: 'Конструктор полей профиля',
};

const EVENT_LABEL: Record<AuditEvent, string> = {
  ROLE_CREATED: 'Создание роли',
  ROLE_UPDATED: 'Изменение роли',
  ROLE_DELETED: 'Удаление роли',
  ROLE_MATRIX_CHANGED: 'Изменение матрицы привилегий',
  USER_BOUND_TO_DEPARTMENT: 'Привязка пользователя к отделу',
  DEPARTMENT_CREATED: 'Создание отдела',
  DEPARTMENT_UPDATED: 'Изменение отдела',
  DEPARTMENT_DELETED: 'Удаление отдела',
  DIRECTORY_ITEM_CREATED: 'Добавление локального справочника',
  DIRECTORY_ITEM_UPDATED: 'Изменение локального справочника',
  DIRECTORY_ITEM_DELETED: 'Удаление локального справочника',
  USER_CREATED: 'Создание пользователя',
  USER_UPDATED: 'Изменение пользователя',
  USER_ACTIVATED: 'Активация пользователя',
  USER_DEACTIVATED: 'Деактивация пользователя',
  PROGRAM_CREATED: 'Создание программы',
  PROGRAM_UPDATED: 'Изменение программы',
  PROGRAM_DELETED: 'Удаление программы',
  GROUP_CREATED: 'Создание группы',
  GROUP_UPDATED: 'Изменение группы',
  GROUP_DELETED: 'Удаление группы',
  GROUP_LISTENERS_ADDED: 'Зачисление слушателей',
  GROUP_LISTENER_REMOVED: 'Исключение слушателя',
  TRAINER_ADDED: 'Добавление тренера',
  TRAINER_ACTIVATED: 'Активация тренера',
  TRAINER_DEACTIVATED: 'Деактивация тренера',
  APPLICATION_CONFIRMED: 'Подтверждение заявки',
  APPLICATION_REJECTED: 'Отклонение заявки',
  PROFILE_FIELD_CREATED: 'Создание поля профиля',
  PROFILE_FIELD_UPDATED: 'Изменение поля профиля',
  PROFILE_FIELD_DELETED: 'Удаление поля профиля',
  PROFILE_FIELD_TOGGLED: 'Включение / выключение глобального поля',
  PROFILE_SCHEME_CREATED: 'Создание набора полей',
  PROFILE_SCHEME_UPDATED: 'Изменение набора полей',
  PROFILE_SCHEME_DELETED: 'Удаление набора полей',
  TRAINER_SCHEME_CHANGED: 'Смена анкеты тренера',
};

/** Цвет метки по виду действия: создание, удаление, привязка, изменение */
function eventColor(event: AuditEvent) {
  if (/CREATED|ADDED|ACTIVATED$|CONFIRMED/.test(event) && !event.endsWith('DEACTIVATED')) return 'green';
  if (/DELETED|REMOVED|DEACTIVATED|REJECTED/.test(event)) return 'red';
  if (event === 'USER_BOUND_TO_DEPARTMENT') return 'purple';
  return 'blue';
}

/** Модуль события — для фильтра типов событий внутри выбранного модуля */
const moduleOf = (event: AuditEvent): AuditModule => {
  if (event.startsWith('ROLE_')) return 'ROLES';
  if (event.startsWith('DIRECTORY_')) return 'DIRECTORIES';
  if (event.startsWith('USER_')) return 'USERS';
  if (event.startsWith('PROGRAM_')) return 'PROGRAMS';
  if (event.startsWith('GROUP_')) return 'GROUPS';
  if (event.startsWith('TRAINER_SCHEME')) return 'PROFILE_FIELDS';
  if (event.startsWith('TRAINER_')) return 'TRAINERS';
  if (event.startsWith('APPLICATION_')) return 'SHOWCASE';
  if (event.startsWith('PROFILE_')) return 'PROFILE_FIELDS';
  return 'DEPARTMENTS';
};

const showValue = (value: string | null) => value ?? '—';

function ChangeLine({ change }: { change: AuditChange }) {
  return (
    <div className="text-xs">
      <span className="font-medium">{change.field}: </span>
      <Typography.Text delete={Boolean(change.oldValue && change.newValue)} type="secondary" style={{ fontSize: 12 }}>
        {showValue(change.oldValue)}
      </Typography.Text>
      {' → '}
      <span className="break-all">{showValue(change.newValue)}</span>
    </div>
  );
}

export function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [module, setModule] = useState<AuditModule | ''>('');
  const [event, setEvent] = useState<AuditEvent | ''>('');
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const filters = useMemo<AuditFilters>(
    () => ({
      search: debouncedSearch,
      tenantId,
      module,
      event,
      dateFrom: range?.[0]?.startOf('day').toISOString() ?? '',
      dateTo: range?.[1]?.endOf('day').toISOString() ?? '',
      page,
      pageSize,
    }),
    [debouncedSearch, tenantId, module, event, range, page, pageSize],
  );
  const logs = useQuery({
    queryKey: queryKeys.audit(filters),
    queryFn: () => api.audit.list(filters),
    placeholderData: keepPreviousData,
  });
  const organizations = useQuery({
    queryKey: queryKeys.organizationsAll,
    queryFn: () => api.organizations.list({ search: '', status: '', tariffPlanId: '', page: 1, pageSize: 100 }),
  });
  const resetPage = () => setPage(1);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Typography.Title level={3} style={{ margin: 0 }}>
        Лог действий
      </Typography.Title>
      <Card styles={{ body: { padding: 0 } }} data-testid="audit-trail">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          <Input
            allowClear
            prefix={<Search size={14} className="text-muted" aria-hidden />}
            placeholder="Организация или администратор"
            aria-label="Поиск по организации или администратору"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              resetPage();
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Все организации"
            aria-label="Фильтр по организации"
            loading={organizations.isPending}
            value={tenantId || undefined}
            options={organizations.data?.items.map((organization) => ({ value: organization.tenantId, label: organization.name }))}
            onChange={(value) => {
              setTenantId(value ?? '');
              resetPage();
            }}
          />
          <Select
            allowClear
            placeholder="Все модули"
            aria-label="Фильтр по модулю"
            value={module || undefined}
            options={(Object.entries(MODULE_LABEL) as [AuditModule, string][]).map(([value, label]) => ({ value, label }))}
            onChange={(value) => {
              setModule(value ?? '');
              if (value && event && moduleOf(event) !== value) setEvent('');
              resetPage();
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Все события"
            aria-label="Фильтр по типу события"
            value={event || undefined}
            options={(Object.entries(EVENT_LABEL) as [AuditEvent, string][])
              .filter(([value]) => !module || moduleOf(value) === module)
              .map(([value, label]) => ({ value, label }))}
            onChange={(value) => {
              setEvent(value ?? '');
              resetPage();
            }}
          />
          <DatePicker.RangePicker
            className="w-full"
            format="DD.MM.YYYY"
            placeholder={['Дата от', 'Дата до']}
            aria-label="Фильтр по датам"
            value={range}
            presets={[
              { label: 'Сегодня', value: [dayjs(), dayjs()] },
              { label: 'За неделю', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: 'За месяц', value: [dayjs().subtract(1, 'month'), dayjs()] },
            ]}
            onChange={(value) => {
              setRange(value);
              resetPage();
            }}
          />
        </div>
        {logs.isError ? (
          <div className="p-6">
            <ErrorState error={logs.error} onRetry={() => void logs.refetch()} />
          </div>
        ) : (
          <Table<AuditEntry>
            rowKey="id"
            loading={logs.isPending}
            dataSource={logs.data?.items}
            scroll={{ x: 1260 }}
            locale={{ emptyText: 'Записи не найдены' }}
            pagination={{
              current: page,
              pageSize,
              total: logs.data?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPageSize === pageSize ? nextPage : 1);
                setPageSize(nextPageSize);
              },
            }}
            columns={[
              { title: 'Дата и время', key: 'at', width: 180, render: (_, entry) => formatDateTimeSeconds(entry.at) },
              {
                title: 'Организация и пользователь',
                key: 'organization',
                width: 290,
                render: (_, entry) => (
                  <div>
                    <Link to={`/superadmin/organizations/${entry.tenantId}`}>{entry.organizationName}</Link>
                    <div className="text-xs">{entry.adminName}</div>
                    <div className="mono text-xs text-muted">{entry.adminLogin} · ID: {entry.adminId}</div>
                    <div className="mono text-xs text-muted">IP: {entry.ipAddress}</div>
                  </div>
                ),
              },
              { title: 'Модуль / Раздел', key: 'module', width: 180, render: (_, entry) => MODULE_LABEL[entry.module] },
              {
                title: 'Тип события',
                key: 'event',
                width: 250,
                render: (_, entry) => (
                  <div>
                    <Tag color={eventColor(entry.event)}>{EVENT_LABEL[entry.event]}</Tag>
                    <div className="mt-1 text-xs text-muted">{entry.target}</div>
                  </div>
                ),
              },
              {
                title: 'Детали изменения (было → стало)',
                key: 'changes',
                render: (_, entry) => entry.changes.map((change, index) => <ChangeLine key={`${change.field}-${index}`} change={change} />),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
