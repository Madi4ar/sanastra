import { Card, Empty, Input, Progress, Segmented, Select, Tag } from 'antd';
import { BookOpen, ChartColumn, GraduationCap, PlayCircle, Search, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { tokens } from '@/app/theme';
import type { ModuleData } from '@/api/endpoints';
import type { Course } from '@/api/types';
import { CardGrid } from '@/features/tenant/ModuleCard';
import { StatCard, StatGrid, TONE_CLASS, type Tone } from '@/features/tenant/StatCard';
import { formatDate } from '@/shared/format';
import { PageHeader } from '@/pages/tenant/PageHeader';
import { useCabinet } from '@/features/tenant/cabinet';

type Filter = 'ALL' | 'PUBLISHED' | 'DRAFT';
const CATEGORY_TONES: Tone[] = ['primary', 'info', 'success', 'warning', 'neutral'];

function CourseCard({ course, tone }: { course: Course; tone: Tone }) {
  const published = course.status === 'PUBLISHED';
  const { base } = useCabinet();
  return (
    <Link to={`${base}/m/COURSES/${encodeURIComponent(course.id)}`} className="block h-full" aria-label={`Открыть курс «${course.title}»`}>
    <Card hoverable className="h-full" styles={{ body: { padding: 0, height: '100%' } }} data-testid={`course-${course.id}`}>
      <div className="flex h-full flex-col">
        <div className={`relative flex h-24 items-center justify-center rounded-t-lg ${TONE_CLASS[tone]}`}>
          <BookOpen size={36} aria-hidden />
          <span className="absolute top-3 left-3">
            <Tag color={published ? 'green' : 'default'}>{published ? 'Опубликован' : 'Черновик'}</Tag>
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="min-w-0">
            <p className="m-0 text-xs font-medium tracking-wide text-muted uppercase">{course.category}</p>
            <p className="m-0 mt-1 line-clamp-2 font-semibold text-text" title={course.title}>
              {course.title}
            </p>
          </div>
          <p className="m-0 flex items-center gap-1.5 text-sm text-muted">
            <UserRound size={14} aria-hidden /> {course.teacher}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="tabular inline-flex items-center gap-1.5">
              <PlayCircle size={14} aria-hidden /> {course.lessonsCount} уроков
            </span>
            <span className="tabular inline-flex items-center gap-1.5">
              <Users size={14} aria-hidden /> {course.studentsCount} учеников
            </span>
          </div>
          <div className="mt-auto">
            {published ? (
              <>
                <div className="flex justify-between text-xs text-muted">
                  <span>Средний прогресс</span>
                  <span className="tabular font-medium text-text">{course.progress}%</span>
                </div>
                <Progress percent={course.progress} showInfo={false} strokeColor={tokens.colorPrimary} size="small" />
              </>
            ) : (
              <p className="m-0 text-xs text-muted">Обновлён {formatDate(course.updatedAt)} · не виден ученикам</p>
            )}
          </div>
        </div>
      </div>
    </Card>
    </Link>
  );
}

export function CoursesView({ data }: { data: ModuleData }) {
  const courses = data.courses ?? [];
  const categories = data.categories ?? [];
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('');

  const published = courses.filter((c) => c.status === 'PUBLISHED');
  const students = published.reduce((a, c) => a + c.studentsCount, 0);
  const avgProgress = published.length ? Math.round(published.reduce((a, c) => a + c.progress, 0) / published.length) : 0;
  const toneOf = (cat: string) => CATEGORY_TONES[Math.max(0, categories.indexOf(cat)) % CATEGORY_TONES.length]!;

  const q = search.trim().toLowerCase();
  const visible = courses
    .filter((c) => filter === 'ALL' || c.status === filter)
    .filter((c) => !category || c.category === category)
    .filter((c) => !q || c.title.toLowerCase().includes(q) || c.teacher.toLowerCase().includes(q));

  return (
    <div data-testid="courses-view">
      <PageHeader
        title="Курсы"
        subtitle={`${courses.length} курсов в организации, опубликовано ${published.length}`}
      />

      <StatGrid>
        <StatCard label="Всего курсов" value={courses.length} icon={<BookOpen size={20} />} />
        <StatCard label="Опубликовано" value={published.length} tone="success" icon={<GraduationCap size={20} />} />
        <StatCard label="Учеников" value={students} tone="info" icon={<Users size={20} />} />
        <StatCard label="Средний прогресс" value={`${avgProgress}%`} tone="warning" icon={<ChartColumn size={20} />} />
      </StatGrid>

      <Card style={{ marginTop: 24 }} styles={{ body: { padding: 12 } }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Segmented<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { label: 'Все', value: 'ALL' },
              { label: 'Опубликованные', value: 'PUBLISHED' },
              { label: 'Черновики', value: 'DRAFT' },
            ]}
          />
          <Select
            aria-label="Категория курса"
            value={category}
            onChange={setCategory}
            style={{ minWidth: 200 }}
            options={[{ value: '', label: 'Все категории' }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
          <Input
            allowClear
            aria-label="Поиск курса"
            placeholder="Поиск по названию или преподавателю"
            prefix={<Search size={16} aria-hidden className="text-muted" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:ml-auto"
            style={{ maxWidth: 340 }}
          />
        </div>
      </Card>

      <div className="mt-4">
        {visible.length ? (
          <CardGrid testId="courses-grid" min={260}>
            {visible.map((c) => (
              <CourseCard key={c.id} course={c} tone={toneOf(c.category)} />
            ))}
          </CardGrid>
        ) : (
          <Card>
            <Empty description={courses.length ? 'Курсы не найдены — измените фильтры' : 'Курсов пока нет'} />
          </Card>
        )}
      </div>
    </div>
  );
}
