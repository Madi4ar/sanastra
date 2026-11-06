import { useQuery } from '@tanstack/react-query';
import { Button, Card, Modal, Tag } from 'antd';
import { Lock, PlayCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CatalogModule } from '@/api/types';
import { useCabinet } from '@/features/tenant/cabinet';
import { ModuleIcon } from '@/shared/ModuleIcon';

/** Видео-демонстрации модулей: ссылка подставляется, когда ролик будет готов */
const DEMO_VIDEO_URL: Partial<Record<string, string>> = {};

const PROMO_FEATURES: Record<string, string[]> = {
  COURSES: ['Учебные программы из модулей, дней и элементов контента', 'Тесты, задания, видео и SCORM в одном курсе'],
  SCHEDULE: ['Общий календарь занятий и событий', 'Расписание для каждой учебной группы'],
  REPORTS: ['Сводные отчёты по успеваемости и посещаемости', 'Прохождение курсов и активность сотрудников, выгрузка в CSV'],
  CHAT: ['Переписка между слушателями и тренерами', 'Вопросы по курсу в одном месте'],
  WEBINARS: ['Онлайн-трансляции для учебных групп', 'Записи занятий и регистрация участников'],
  CERTIFICATES: ['Автоматическая выдача сертификатов', 'Подтверждение прохождения обучения'],
};

export function useModuleCatalog(clientSlug: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.moduleCatalog(clientSlug),
    queryFn: () => api.tenantAdmin(clientSlug).catalog(),
    enabled,
  });
}

export const demoBadgeText = (m: Pick<CatalogModule, 'upgradeTariff'>) =>
  m.upgradeTariff ? `Демо / Доступно в тарифе ${m.upgradeTariff.name}` : 'Демо';

export function DemoBadge({ module }: { module: CatalogModule }) {
  return (
    <Tag color="gold" icon={<Lock size={12} className="mr-1 inline" aria-hidden />} data-testid={`demo-badge-${module.code}`}>
      {demoBadgeText(module)}
    </Tag>
  );
}

function PromoBody({ module }: { module: CatalogModule }) {
  const video = DEMO_VIDEO_URL[module.code];
  return (
    <div className="flex flex-col gap-4" data-testid={`promo-${module.code}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <ModuleIcon name={module.icon} />
        </span>
        <span className="text-lg font-semibold">{module.name}</span>
        <DemoBadge module={module} />
      </div>
      {video ? (
        <video src={video} controls className="aspect-video w-full rounded-lg bg-black" aria-label={`Демонстрация модуля «${module.name}»`} />
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg bg-subtle text-muted">
          <PlayCircle size={40} aria-hidden />
          <span className="text-sm">Видео-демонстрация модуля появится здесь</span>
        </div>
      )}
      <p className="m-0">{module.description}</p>
      {PROMO_FEATURES[module.code] && (
        <ul className="m-0 flex flex-col gap-1 pl-5">
          {PROMO_FEATURES[module.code]!.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {!module.upgradeTariff && (
        <p className="m-0 text-sm text-muted">Чтобы подключить модуль, обратитесь к администратору Sanastra.</p>
      )}
    </div>
  );
}

function UpgradeButton({ module, onGo }: { module: CatalogModule; onGo?: () => void }) {
  const { base } = useCabinet();
  const navigate = useNavigate();
  if (!module.upgradeTariff) return null;
  return (
    <Button
      type="primary"
      onClick={() => {
        onGo?.();
        navigate(`${base}/organization/subscription?upgrade=${encodeURIComponent(module.upgradeTariff!.id)}`);
      }}
    >
      Перейти на тариф {module.upgradeTariff.name}
    </Button>
  );
}

/** Промо-окно при клике на закрытый модуль */
export function UpgradePromoModal({ module, onClose }: { module: CatalogModule; onClose: () => void }) {
  return (
    <Modal
      open
      width={640}
      title="Модуль не входит в ваш тариф"
      onCancel={onClose}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={onClose}>
          Закрыть
        </Button>,
        <UpgradeButton key="go" module={module} onGo={onClose} />,
      ]}
    >
      <PromoBody module={module} />
    </Modal>
  );
}

/** То же содержимое при прямом переходе по адресу закрытого модуля */
export function LockedModulePage({ module }: { module: CatalogModule }) {
  return (
    <Card>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <PromoBody module={module} />
        <div>
          <UpgradeButton module={module} />
        </div>
      </div>
    </Card>
  );
}
