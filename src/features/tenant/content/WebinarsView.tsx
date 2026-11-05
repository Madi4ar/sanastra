import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Empty, Progress, Tag } from 'antd';
import dayjs from 'dayjs';
import { Check, Clock, PlayCircle, Radio, UserRound, Users, Video } from 'lucide-react';
import { tokens } from '@/app/theme';
import { isApiError } from '@/api/client';
import { api, type ModuleData } from '@/api/endpoints';
import { queryKeys } from '@/api/queryKeys';
import type { Webinar } from '@/api/types';
import { CardGrid } from '@/features/tenant/ModuleCard';
import { PageHeader, SectionTitle } from '@/pages/tenant/PageHeader';

const timeRange = (w: Webinar) =>
  `${dayjs(w.startsAt).format('HH:mm')}–${dayjs(w.startsAt).add(w.durationMin, 'minute').format('HH:mm')}`;

function useRegistration(clientSlug: string) {
  const qc = useQueryClient();
  const { message } = App.useApp();
  return useMutation({
    mutationFn: (id: string) => api.tenant.toggleWebinarRegistration(clientSlug, id),
    onSuccess: ({ registered }) => {
      message.success(registered ? 'Вы записаны на вебинар' : 'Запись отменена');
      void qc.invalidateQueries({ queryKey: queryKeys.tenantModuleData(clientSlug, 'WEBINARS') });
    },
    onError: (e) => message.error(isApiError(e) ? e.message : 'Не удалось изменить запись'),
  });
}

/** Эфир сейчас — крупная градиентная карточка, как карточка ближайшего урока в NIS Academy. */
function LiveCard({ w }: { w: Webinar }) {
  const { message } = App.useApp();
  return (
    <div
      className="relative overflow-hidden rounded-lg p-6 text-white sm:p-8"
      style={{ background: `linear-gradient(135deg, ${tokens.colorPrimary} 0%, ${tokens.colorPrimaryHover} 100%)` }}
      data-testid={`webinar-live-${w.id}`}
    >
      <span className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10" aria-hidden />
      <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Сейчас в эфире
      </span>
      <h2 className="m-0 mt-3 text-2xl font-bold sm:text-3xl">{w.title}</h2>
      <p className="m-0 mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 opacity-85">
        <span className="inline-flex items-center gap-1.5">
          <UserRound size={16} aria-hidden /> {w.speaker}
        </span>
        <span className="tabular inline-flex items-center gap-1.5">
          <Clock size={16} aria-hidden /> {timeRange(w)}
        </span>
        <span className="tabular inline-flex items-center gap-1.5">
          <Users size={16} aria-hidden /> {w.registered} участников
        </span>
      </p>
      <Button
        size="large"
        className="mt-6"
        icon={<Radio size={16} />}
        onClick={() => message.info('Демо: тестовая ссылка на трансляцию')}
        style={{ background: tokens.colorBgSurface, color: tokens.colorPrimary, borderColor: 'transparent' }}
      >
        Присоединиться
      </Button>
    </div>
  );
}

function UpcomingRow({ w, clientSlug }: { w: Webinar; clientSlug: string }) {
  const reg = useRegistration(clientSlug);
  const d = dayjs(w.startsAt);
  const full = !w.registeredByMe && w.registered >= w.capacity;
  return (
    <Card styles={{ body: { padding: 16 } }} data-testid={`webinar-${w.id}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-soft text-primary">
          <span className="tabular text-2xl leading-none font-bold">{d.format('D')}</span>
          <span className="text-xs font-medium">{d.format('MMM')}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-semibold text-text">{w.title}</p>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={14} aria-hidden /> {w.speaker}
            </span>
            <span className="tabular inline-flex items-center gap-1.5">
              <Clock size={14} aria-hidden /> {d.format('dd')}, {timeRange(w)} · {w.durationMin} мин
            </span>
          </p>
          <div className="mt-2 flex max-w-xs items-center gap-2">
            <Progress
              percent={Math.round((w.registered / w.capacity) * 100)}
              showInfo={false}
              size="small"
              strokeColor={tokens.colorSecondary}
              aria-label={`Записалось ${w.registered} из ${w.capacity}`}
            />
            <span className="tabular shrink-0 text-xs text-muted">
              {w.registered} из {w.capacity}
            </span>
          </div>
        </div>
        {w.registeredByMe ? (
          <Button icon={<Check size={16} />} loading={reg.isPending} onClick={() => reg.mutate(w.id)} aria-label={`Отменить запись: ${w.title}`}>
            Вы записаны
          </Button>
        ) : (
          <Button type="primary" disabled={full} loading={reg.isPending} onClick={() => reg.mutate(w.id)} aria-label={`Записаться: ${w.title}`}>
            {full ? 'Мест нет' : 'Записаться'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function RecordingCard({ w }: { w: Webinar }) {
  const { message } = App.useApp();
  return (
    <Card className="h-full" styles={{ body: { padding: 0, height: '100%' } }} data-testid={`webinar-${w.id}`}>
      <div className="flex h-full flex-col">
        <div className="flex h-24 items-center justify-center rounded-t-lg bg-subtle text-muted">
          <PlayCircle size={36} aria-hidden />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <Tag className="self-start">Запись</Tag>
          <p className="m-0 line-clamp-2 font-semibold text-text" title={w.title}>
            {w.title}
          </p>
          <p className="m-0 text-sm text-muted">
            {w.speaker} · {dayjs(w.startsAt).format('D MMMM')} · {w.durationMin} мин
          </p>
          <Button
            className="mt-auto self-start"
            type="link"
            icon={<PlayCircle size={16} />}
            style={{ paddingInline: 0 }}
            onClick={() => message.info('Демо: запись вебинара')}
          >
            Смотреть запись
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function WebinarsView({ data, clientSlug }: { data: ModuleData; clientSlug: string }) {
  const webinars = data.webinars ?? [];
  const live = webinars.filter((w) => w.status === 'LIVE');
  const upcoming = webinars.filter((w) => w.status === 'UPCOMING');
  const recorded = webinars.filter((w) => w.status === 'RECORDED').reverse();
  const myCount = upcoming.filter((w) => w.registeredByMe).length;

  return (
    <div data-testid="webinars-view">
      <PageHeader
        title="Вебинары"
        subtitle={
          myCount
            ? `Вы записаны на ${myCount} из ${upcoming.length} предстоящих вебинаров`
            : 'Прямые эфиры, предстоящие встречи и записи прошедших вебинаров'
        }
      />
      <div className="flex flex-col gap-8">
      {live.map((w) => (
        <LiveCard key={w.id} w={w} />
      ))}

      <section aria-labelledby="upcoming-h">
        <SectionTitle title={<span id="upcoming-h">Предстоящие</span>} />
        {upcoming.length ? (
          <div className="flex flex-col gap-3" data-testid="webinars-upcoming">
            {upcoming.map((w) => (
              <UpcomingRow key={w.id} w={w} clientSlug={clientSlug} />
            ))}
          </div>
        ) : (
          <Card>
            <Empty image={<Video size={40} className="text-muted" aria-hidden />} description="Предстоящих вебинаров нет" />
          </Card>
        )}
      </section>

      <section aria-labelledby="records-h">
        <SectionTitle title={<span id="records-h">Записи</span>} />
        {recorded.length ? (
          <CardGrid testId="webinars-recorded" min={240}>
            {recorded.map((w) => (
              <RecordingCard key={w.id} w={w} />
            ))}
          </CardGrid>
        ) : (
          <Card>
            <Empty description="Записей пока нет" />
          </Card>
        )}
      </section>
      </div>
    </div>
  );
}
