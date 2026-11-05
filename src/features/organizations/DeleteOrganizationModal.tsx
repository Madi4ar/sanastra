import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Input, Modal, Typography } from 'antd';
import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { OrganizationDetail } from '@/api/types';
import { broadcastTenantAccessInvalidated } from '@/shared/crossTab';
import { Field } from '@/shared/FormField';

/** Удаление организации необратимо, поэтому подтверждается вводом адреса кабинета. */
export function DeleteOrganizationModal({
  org,
  onClose,
  onDeleted,
}: {
  org: OrganizationDetail;
  onClose: () => void;
  /** Вызывается до перехода в реестр (например, чтобы снять защиту несохранённой формы) */
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [confirmSlug, setConfirmSlug] = useState('');

  const remove = useMutation({
    mutationFn: () => api.organizations.remove(org.tenantId),
    onSuccess: () => {
      onDeleted?.();
      qc.removeQueries({ queryKey: queryKeys.organization(org.tenantId) });
      void qc.invalidateQueries({ queryKey: queryKeys.organizationsAll });
      void qc.invalidateQueries({ queryKey: queryKeys.platformUsersAll });
      void qc.invalidateQueries({ queryKey: queryKeys.tariffPlans });
      broadcastTenantAccessInvalidated();
      message.success(`Организация «${org.name}» удалена`);
      navigate('/superadmin/organizations', { replace: true });
    },
    onError: (e) => message.error(e.message),
  });

  return (
    <Modal
      open
      title={
        <span className="flex items-center gap-2">
          <TriangleAlert size={18} className="text-error" aria-hidden />
          Удалить организацию?
        </span>
      }
      okText="Удалить организацию"
      cancelText="Отмена"
      okButtonProps={{ danger: true, disabled: confirmSlug !== org.clientSlug }}
      confirmLoading={remove.isPending}
      onOk={() => remove.mutate()}
      onCancel={onClose}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-2">
        <Alert
          type="error"
          showIcon
          title="Действие необратимо"
          description={`Будут удалены организация «${org.name}», её подписка и история, курсы и вебинары, а также роли пользователей в этой организации. Учётные записи пользователей сохранятся.`}
        />
        <Field
          label="Для подтверждения введите адрес кабинета"
          htmlFor="delete-org-confirm"
          hint={
            <>
              Адрес: <Typography.Text code>{org.clientSlug}</Typography.Text>
            </>
          }
        >
          <Input
            id="delete-org-confirm"
            className="mono"
            autoComplete="off"
            placeholder={org.clientSlug}
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value.trim())}
          />
        </Field>
      </div>
    </Modal>
  );
}
