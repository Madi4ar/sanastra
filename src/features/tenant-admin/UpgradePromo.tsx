import { useQuery } from '@tanstack/react-query';
import { Button, Card, Modal, Tag } from 'antd';
import { Lock, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { CatalogModule } from '@/api/types';
import { useCurrentUser } from '@/auth/auth';
import { CardGrid } from '@/features/tenant/ModuleCard';
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
  ADV_DIRECTORIES: ['Справочники «Научный уровень» и «Категория»', 'Собственные записи вашей организации в этих справочниках'],
  ADV_CONTENT: ['Интерактивное видео с вопросами и точками взаимодействия', 'SCORM-пакеты электронных курсов и интерактивные таблицы'],
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
  const isAdmin = useCurrentUser().data?.role === 'ORGANIZATION_ADMIN';
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
      <p className="m-0 text-sm text-muted" data-testid="demo-hint">
        {module.upgradeTariff
          ? isAdmin
            ? `Сейчас открыт демо-доступ. Чтобы работать с модулем, перейдите на тариф ${module.upgradeTariff.name}.`
            : `Сейчас открыт демо-доступ. Чтобы работать с модулем, попросите администратора организации перейти на тариф ${module.upgradeTariff.name}.`
          : 'Сейчас открыт демо-доступ. Чтобы подключить модуль, обратитесь к администратору Sanastra.'}
      </p>
    </div>
  );
}

function UpgradeButton({ module, onGo }: { module: CatalogModule; onGo?: () => void }) {
  const { base } = useCabinet();
  const navigate = useNavigate();
  const isAdmin = useCurrentUser().data?.role === 'ORGANIZATION_ADMIN';
  if (!module.upgradeTariff || !isAdmin) return null;
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
      title="Демо-доступ"
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

/** Закрытые модули карточками: клик открывает демо-доступ */
export function DemoModulesGrid({ modules, title }: { modules: CatalogModule[]; title: string }) {
  const [promo, setPromo] = useState<CatalogModule | null>(null);
  if (!modules.length) return null;
  return (
    <section data-testid="demo-modules">
      <h2 className="m-0 mb-3 text-lg font-semibold text-text">{title}</h2>
      <CardGrid testId="demo-modules-grid">
        {modules.map((m) => (
          <Card key={m.code} hoverable className="h-full" onClick={() => setPromo(m)} data-testid={`demo-module-${m.code}`}>
            <div className="flex flex-col items-start gap-2">
              <ModuleIcon name={m.icon} />
              <span className="font-semibold">{m.name}</span>
              <span className="text-sm text-muted">{m.description}</span>
              <DemoBadge module={m} />
            </div>
          </Card>
        ))}
      </CardGrid>
      {promo && <UpgradePromoModal module={promo} onClose={() => setPromo(null)} />}
    </section>
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
