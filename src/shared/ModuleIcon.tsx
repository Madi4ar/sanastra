import {
  BookOpen,
  Box,
  CalendarDays,
  ChartColumn,
  CreditCard,
  FileText,
  HardDrive,
  MessageSquare,
  Settings,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';

/** Явная карта иконок вместо импорта всего набора lucide (tree-shaking). */
const ICONS: Record<string, LucideIcon> = {
  BookOpen,
  CalendarDays,
  ChartColumn,
  CreditCard,
  FileText,
  HardDrive,
  MessageSquare,
  Settings,
  Users,
  Video,
};

/** className пробрасывается: Ant Design Menu добавляет иконке свой класс отступов. */
export function ModuleIcon({ name, size = 16, className }: { name?: string; size?: number; className?: string }) {
  const Icon = (name && ICONS[name]) || Box;
  return <Icon size={size} className={className} aria-hidden />;
}
