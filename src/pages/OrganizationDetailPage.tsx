import { Button, Card, Result, Skeleton } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useParams } from 'react-router';
import { isApiError } from '@/api/client';
import { useOrganization } from '@/features/organizations/queries';
import { OrganizationEditor } from '@/features/organization-settings/OrganizationEditor';
import { useBackToRegistry } from '@/features/organization-settings/OrganizationHeader';
import { ErrorState } from '@/shared/PageState';

export function OrganizationDetailPage() {
  const { tenantId = '' } = useParams();
  const query = useOrganization(tenantId);
  const back = useBackToRegistry();

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" data-testid="card-skeleton">
        <Card>
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  if (query.isError && !query.data) {
    if (isApiError(query.error) && query.error.code === 'NOT_FOUND') {
      return (
        <Result
          status="404"
          title="Организация не найдена"
          subTitle="Возможно, она была удалена или ссылка устарела."
          extra={
            <Button type="primary" icon={<ArrowLeft size={16} />} onClick={back}>
              Вернуться в реестр
            </Button>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  return (
    <OrganizationEditor
      key={tenantId}
      org={query.data!}
      onReloadLatest={async () => (await query.refetch()).data}
    />
  );
}
