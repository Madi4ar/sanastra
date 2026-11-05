import { Button, Card, Descriptions, Tag, Typography } from 'antd';
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { OrganizationDetail } from '@/api/types';
import { DeleteOrganizationModal } from '@/features/organizations/DeleteOrganizationModal';
import { EditOrganizationModal } from '@/features/organizations/EditOrganizationModal';
import { CopyText } from '@/shared/CopyText';
import { formatDateTime, SOURCE_LABEL } from '@/shared/format';
import { IconButton } from '@/shared/IconButton';
import { StatusTag } from '@/shared/StatusTag';

export function useBackToRegistry() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '';
  return () => navigate(`/superadmin/organizations${from}`);
}

export function OrganizationHeader({ org, onDeleted }: { org: OrganizationDetail; onDeleted?: () => void }) {
  const back = useBackToRegistry();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <Card>
      <div className="flex items-start gap-3">
        <IconButton label="Назад к реестру" icon={<ArrowLeft size={16} />} onClick={back} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Typography.Title level={3} style={{ margin: 0 }}>
              {org.name}
            </Typography.Title>
            <StatusTag status={org.status} />
            <Tag color="blue">Тариф: {org.tariffPlan.name}</Tag>
          </div>
          <Typography.Text type="secondary">
            <span className="mono">{org.clientSlug}</span> · обновлено {formatDateTime(org.updatedAt)} (
            {SOURCE_LABEL[org.updatedBy]})
          </Typography.Text>
        </div>
        <div className="flex gap-2">
          <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
            Редактировать
          </Button>
          <Button href={`/${org.clientSlug}/admin`} target="_blank" icon={<ExternalLink size={16} />}>
            Интерфейс организации
          </Button>
          <Button danger icon={<Trash2 size={16} />} onClick={() => setDeleting(true)}>
            Удалить
          </Button>
        </div>
      </div>
      {editing && <EditOrganizationModal org={org} onClose={() => setEditing(false)} />}
      {deleting && <DeleteOrganizationModal org={org} onClose={() => setDeleting(false)} onDeleted={onDeleted} />}
      <Descriptions
        className="mt-4"
        size="small"
        column={3}
        items={[
          { key: 'id', label: 'tenant_id', children: <CopyText value={org.tenantId} label="tenant_id" /> },
          { key: 'slug', label: 'client_slug', children: <CopyText value={org.clientSlug} label="slug" /> },
          { key: 'created', label: 'Создана', children: formatDateTime(org.createdAt) },
        ]}
      />
    </Card>
  );
}
