import type { Course } from '@/api/types';
import { toRichText } from '@/shared/richText';

/** «О программе»: описание, цель и ожидаемый результат (форматированный текст), трудоёмкость */
export function ProgramAbout({ course }: { course: Course }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rich-text" dangerouslySetInnerHTML={{ __html: toRichText(course.descriptionRu) }} />
      {course.goalRu && (
        <div>
          <span className="font-medium">Цель программы</span>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: toRichText(course.goalRu) }} />
        </div>
      )}
      {course.resultRu && (
        <div>
          <span className="font-medium">Ожидаемый результат</span>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: toRichText(course.resultRu) }} />
        </div>
      )}
      <p className="m-0 text-muted">
        Теория: {course.hoursTheory ?? 0} ч · практика: {course.hoursPractice ?? 0} ч
      </p>
    </div>
  );
}
