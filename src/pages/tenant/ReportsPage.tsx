import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Card, Select, Table } from 'antd';
import { Download, Play } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { ReportResult, ReportType } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { useCabinet } from '@/features/tenant/cabinet';
import { Field } from '@/shared/FormField';
import { formatDateTime } from '@/shared/format';
import { PageHeader } from './PageHeader';

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'PERFORMANCE', label: 'Успеваемость' },
  { value: 'COMPLETION', label: 'Прохождение курсов' },
  { value: 'ATTENDANCE', label: 'Посещаемость' },
  { value: 'ACTIVITY', label: 'Активность пользователей' },
];

/** Значение ячейки CSV: кавычки экранируются, формулы не выполняются при открытии в Excel */
function csvCell(v: string | number): string {
  const s = String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(report: ReportResult) {
  const lines = [
    report.columns.map((c) => csvCell(c.title)).join(';'),
    ...report.rows.map((r) => report.columns.map((c) => csvCell(r[c.key] ?? '')).join(';')),
  ];
  const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.title}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Раздел «Конструктор отчётов»: сводные отчёты по пользователям компании */
export function ReportsPage() {
  const { clientSlug } = useCabinet();
  const { data: user } = useCurrentUser();
  const { message } = App.useApp();
  const admin = api.tenantAdmin(clientSlug);
  const [type, setType] = useState<ReportType>('PERFORMANCE');
  const [groupId, setGroupId] = useState<string>();
  const [courseId, setCourseId] = useState<string>();
  const groups = useQuery({
    queryKey: queryKeys.tenantAdmin(clientSlug, 'groups'),
    queryFn: admin.groups,
    enabled: Boolean(user?.access.includes('lms_groups.view')),
  });
  const courses = useQuery({
    queryKey: queryKeys.tenantModuleData(clientSlug, 'COURSES'),
    queryFn: () => api.tenant.moduleData(clientSlug, 'COURSES'),
    retry: false,
  });
  const generate = useMutation({
    mutationFn: () => admin.report(type, { groupId, courseId }),
    onError: (e) => message.error(e.message),
  });
  const report = generate.data;
  const usesCourse = type === 'PERFORMANCE' || type === 'COMPLETION';

  return (
    <>
      <PageHeader title="Конструктор отчётов" subtitle="Сводные отчёты по успеваемости, прохождению курсов, посещаемости и активности." />
      <div className="flex flex-col gap-4">
        <Card>
          <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Field label="Отчёт" htmlFor="report-type">
              <Select id="report-type" aria-label="Отчёт" style={{ width: '100%' }} value={type} options={REPORT_OPTIONS} onChange={setType} />
            </Field>
            <Field label="Группа" htmlFor="report-group">
              <Select
                id="report-group"
                aria-label="Группа"
                allowClear
                style={{ width: '100%' }}
                placeholder="Все сотрудники"
                value={groupId}
                options={(groups.data ?? []).map((g) => ({ value: g.id, label: g.name }))}
                onChange={setGroupId}
              />
            </Field>
            <Field label="Учебная программа" htmlFor="report-course">
              <Select
                id="report-course"
                aria-label="Учебная программа"
                allowClear
                disabled={!usesCourse}
                style={{ width: '100%' }}
                placeholder="Все программы"
                showSearch={{ optionFilterProp: 'label' }}
                value={usesCourse ? courseId : undefined}
                options={(courses.data?.courses ?? []).map((c) => ({ value: c.id, label: c.title }))}
                onChange={setCourseId}
              />
            </Field>
            <Button type="primary" icon={<Play size={16} />} loading={generate.isPending} onClick={() => generate.mutate()}>
              Сформировать
            </Button>
          </div>
        </Card>
        {report && (
          <Card
            title={report.title}
            extra={
              <Button icon={<Download size={16} />} disabled={!report.rows.length} onClick={() => downloadCsv(report)}>
                Скачать CSV
              </Button>
            }
            styles={{ body: { padding: 0 } }}
            data-testid="report-result"
          >
            <p className="m-0 px-4 pt-3 text-xs text-muted">Сформирован {formatDateTime(report.generatedAt)}</p>
            <Alert
              className="mx-4 mt-3"
              type="info"
              showIcon
              title="Демонстрационные показатели: значения рассчитываются мок-сервером, а не по фактам обучения."
            />
            <Table
              rowKey={(_, i) => String(i)}
              className="mt-3"
              dataSource={report.rows}
              pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
              scroll={{ x: 640 }}
              locale={{ emptyText: 'Нет данных для отчёта' }}
              columns={report.columns.map((c) => ({ title: c.title, dataIndex: c.key, key: c.key }))}
            />
          </Card>
        )}
      </div>
    </>
  );
}
