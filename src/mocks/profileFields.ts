import type { LearnerCourseProgress, ProfileFieldDefinition, ProfileFieldScheme } from '@/api/types';

const KEY = 'superadmin-mock-profile-fields-v3';
interface Store {
  globals: ProfileFieldDefinition[];
  tenantActive: Record<string, string[]>;
  custom: ProfileFieldDefinition[];
  schemes: ProfileFieldScheme[];
  globalTrainerFields: { fieldId: string; required: boolean }[];
  trainerSchemeByTenant: Record<string, string>;
  values: Record<string, Record<string, string>>;
  progress: LearnerCourseProgress[];
  attendance: Record<string, boolean>;
}
const NAMES = ['ИИН', 'ФИО', 'Email', 'Телефон', 'Пол', 'Национальность', 'Область', 'Район', 'Должность', 'Образование', 'Уровень науки', 'Категория', 'Организация образования'];
const initial = (): Store => ({
  globals: NAMES.map((name, i) => ({ id: `global-${i + 1}`, tenantId: null, system: true, active: true, labelKz: name, labelRu: name, labelEn: name, type: 'TEXT', options: [] })),
  tenantActive: {}, custom: [], schemes: [], globalTrainerFields: [], trainerSchemeByTenant: {}, values: {}, progress: [], attendance: {},
});
let memory: Store | null = null;
const storage = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
export function loadProfileFields(): Store {
  if (memory) return memory;
  try { const raw = storage()?.getItem(KEY); if (raw) return (memory = JSON.parse(raw) as Store); } catch { /* recreate */ }
  return (memory = initial());
}
export function saveProfileFields(store: Store) { memory = store; try { storage()?.setItem(KEY, JSON.stringify(store)); } catch { /* fallback */ } }
export function resetProfileFields() { memory = null; try { storage()?.removeItem(KEY); } catch { /* ignore */ } }
export function fieldsForTenant(tenantId: string): ProfileFieldDefinition[] {
  const s = loadProfileFields();
  const active = s.tenantActive[tenantId] ?? s.globals.filter((f) => f.active).map((f) => f.id);
  return [...s.globals.filter((f) => f.active && active.includes(f.id)), ...s.custom.filter((f) => f.tenantId === tenantId && f.active)];
}
export function ensureDefaultScheme(tenantId: string): ProfileFieldScheme {
  const s = loadProfileFields();
  let scheme = s.schemes.find((x) => x.tenantId === tenantId);
  if (!scheme) { scheme = { id: `${tenantId}-profile-default`, tenantId, name: 'Основная схема', fields: fieldsForTenant(tenantId).map((f) => ({ fieldId: f.id, required: false })) }; s.schemes.push(scheme); saveProfileFields(s); }
  return scheme;
}
export const schemesForTenant = (tenantId: string) => { ensureDefaultScheme(tenantId); return loadProfileFields().schemes.filter((x) => x.tenantId === tenantId); };
export const profileValueKey = (tenantId: string, groupId: string, userId: string) => `${tenantId}:${groupId}:${userId}`;
export function progressFor(groupId: string, userId: string): LearnerCourseProgress {
  const s = loadProfileFields(); let item = s.progress.find((x) => x.groupId === groupId && x.userId === userId);
  if (!item) { item = { groupId, userId, completedElementIds: [], answers: {}, grades: {} }; s.progress.push(item); saveProfileFields(s); }
  return item;
}
