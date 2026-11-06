/**
 * API справочников. Суперадминистратор управляет глобальными записями и не видит локальные;
 * организация видит глобальные ∪ свои записи и меняет только свои, по матрице доступов и тарифу.
 */
import { http, HttpResponse } from 'msw';
import type { CurrentUser, DirectoryAction, DirectoryItem, DirectoryItemPayload, TenantDirectorySummary } from '@/api/types';
import { TARIFF_MODULE_OF } from '@/shared/access';
import { DIRECTORIES, directoryModuleKey, isDirectoryCode, type DirectoryCode } from '@/shared/directories';
import { allCoursesUsing } from './content';
import { effectiveModules, type OrgRecord } from './db';
import { isVisibleItem, loadDirectories, saveDirectories, visibleItems, type DirectoryRecord } from './directories';
import { err, latency, requireRole, subscriptionGuard, tenantContext } from './handlers';
import { loadStructure, localMatrixOf } from './orgStructure';
import { matrixOf } from './roles';
import { upgradeTariffFor } from './tenantAdminHandlers';
import { loadUsers } from './users';

const option = (code: string, action: DirectoryAction) => `${directoryModuleKey(code)}.${action}`;

function toItem(r: DirectoryRecord, editable: boolean): DirectoryItem {
  const parent = loadDirectories().find((i) => i.id === r.parentId);
  return {
    id: r.id,
    nameKz: r.nameKz,
    nameRu: r.nameRu,
    parentId: r.parentId,
    parentName: parent?.nameRu ?? null,
    scope: r.tenantId === null ? 'GLOBAL' : 'LOCAL',
    editable,
    createdAt: r.createdAt,
  };
}

const norm = (v: string) => v.trim().toLowerCase();

/** Единая проверка: дубликат ищется только среди записей, видимых автору, чтобы не раскрывать чужие */
function validate(code: DirectoryCode, body: Partial<DirectoryItemPayload>, tenantId: string | null, selfId?: string) {
  const fe: Record<string, string> = {};
  const nameKz = (body.nameKz ?? '').trim();
  const nameRu = (body.nameRu ?? '').trim();
  if (!nameKz || nameKz.length > 200) fe.nameKz = 'Название на казахском — от 1 до 200 символов';
  if (!nameRu || nameRu.length > 200) fe.nameRu = 'Название на русском — от 1 до 200 символов';
  const others = visibleItems(code, tenantId).filter((i) => i.id !== selfId);
  if (!fe.nameKz && others.some((i) => norm(i.nameKz) === norm(nameKz))) fe.nameKz = 'Такая запись уже есть в справочнике';
  if (!fe.nameRu && others.some((i) => norm(i.nameRu) === norm(nameRu))) fe.nameRu = 'Такая запись уже есть в справочнике';
  if (code === 'district' && !isVisibleItem(body.parentId ?? '', 'region', tenantId)) fe.parentId = 'Выберите область';
  return fe;
}

/** Запись нельзя удалить, пока на неё ссылаются карточки и курсы */
function usageError(item: DirectoryRecord): string | null {
  const store = loadStructure();
  const scope = <T extends { tenantId: string }>(list: T[]) => (item.tenantId ? list.filter((x) => x.tenantId === item.tenantId) : list);
  if (scope(store.members).some((m) => m.positionId === item.id)) return 'Запись указана в карточках сотрудников.';
  if (scope(store.trainers).some((t) => t.categoryId === item.id)) return 'Запись указана у тренеров.';
  if (allCoursesUsing(item.id, item.tenantId)) return 'Запись используется в учебных программах.';
  if (item.code === 'region') {
    if (loadDirectories().some((i) => i.code === 'district' && i.parentId === item.id && (item.tenantId === null || i.tenantId === item.tenantId)))
      return 'Сначала удалите районы этой области.';
    if (item.tenantId === null && loadUsers().some((u) => u.region === item.nameRu)) return 'Область указана в профилях пользователей.';
  }
  return null;
}

function create(code: DirectoryCode, body: Partial<DirectoryItemPayload>, tenantId: string | null): DirectoryRecord {
  const record: DirectoryRecord = {
    id: crypto.randomUUID(),
    code,
    tenantId,
    nameKz: body.nameKz!.trim(),
    nameRu: body.nameRu!.trim(),
    parentId: code === 'district' ? (body.parentId ?? null) : null,
    createdAt: new Date().toISOString(),
  };
  saveDirectories([...loadDirectories(), record]);
  return record;
}

function update(id: string, code: DirectoryCode, body: Partial<DirectoryItemPayload>): DirectoryRecord {
  const items = loadDirectories();
  const record = items.find((i) => i.id === id)!;
  Object.assign(record, {
    nameKz: body.nameKz!.trim(),
    nameRu: body.nameRu!.trim(),
    parentId: code === 'district' ? (body.parentId ?? null) : null,
  });
  saveDirectories(items);
  return record;
}

/** Режим справочника для пользователя: рабочий, демо (включён в матрице, закрыт тарифом) или скрыт */
function modeOf(code: string, user: CurrentUser, org: OrgRecord): 'WORK' | 'DEMO' | null {
  if (user.access.includes(option(code, 'view'))) return 'WORK';
  const raw = [...matrixOf(user.role, user.customRole), ...localMatrixOf(user.id, org.clientSlug)];
  const tariffModule = TARIFF_MODULE_OF[directoryModuleKey(code)];
  const granted = raw.includes(option(code, 'view'));
  return granted && tariffModule && !effectiveModules(org).includes(tariffModule) ? 'DEMO' : null;
}

function tenantDirectory(request: Request, code: string, action: DirectoryAction) {
  const ctx = tenantContext(request);
  if (ctx instanceof Response) return ctx;
  const blocked = subscriptionGuard(ctx.org);
  if (blocked) return blocked;
  if (!isDirectoryCode(code)) return err(404, 'NOT_FOUND');
  // Суперадминистратор не управляет локальными данными компаний
  if (ctx.user.role === 'SUPERADMIN' || !ctx.user.access.includes(option(code, action))) return err(403, 'FORBIDDEN');
  return { ...ctx, code };
}

const fieldsError = (fe: Record<string, string>) => err(400, 'VALIDATION_ERROR', 'Проверьте правильность заполнения полей.', fe);

export const directoryHandlers = () => [
  // ---------- Суперадминистратор: глобальные записи ----------
  http.get('/api/superadmin/directories', async () => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    return HttpResponse.json(
      DIRECTORIES.map((d) => ({ code: d.code, name: d.name, count: visibleItems(d.code, null).length })),
    );
  }),

  http.get('/api/superadmin/directories/:code/items', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const code = String(params.code);
    if (!isDirectoryCode(code)) return err(404, 'NOT_FOUND');
    return HttpResponse.json(visibleItems(code, null).map((i) => toItem(i, true)));
  }),

  http.post('/api/superadmin/directories/:code/items', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const code = String(params.code);
    if (!isDirectoryCode(code)) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<DirectoryItemPayload>;
    const fe = validate(code, body, null);
    if (Object.keys(fe).length) return fieldsError(fe);
    return HttpResponse.json(toItem(create(code, body, null), true), { status: 201 });
  }),

  http.put('/api/superadmin/directories/:code/items/:id', async ({ params, request }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const code = String(params.code);
    if (!isDirectoryCode(code)) return err(404, 'NOT_FOUND');
    const item = visibleItems(code, null).find((i) => i.id === params.id);
    if (!item) return err(404, 'NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as Partial<DirectoryItemPayload>;
    const fe = validate(code, body, null, item.id);
    if (Object.keys(fe).length) return fieldsError(fe);
    return HttpResponse.json(toItem(update(item.id, code, body), true));
  }),

  http.delete('/api/superadmin/directories/:code/items/:id', async ({ params }) => {
    await latency();
    const denied = requireRole('SUPERADMIN');
    if (denied) return denied;
    const code = String(params.code);
    if (!isDirectoryCode(code)) return err(404, 'NOT_FOUND');
    const item = visibleItems(code, null).find((i) => i.id === params.id);
    if (!item) return err(404, 'NOT_FOUND');
    const used = usageError(item);
    if (used) return err(400, 'VALIDATION_ERROR', `Нельзя удалить. ${used}`);
    saveDirectories(loadDirectories().filter((i) => i.id !== item.id));
    return new HttpResponse(null, { status: 204 });
  }),

  // ---------- Организация: глобальные ∪ свои записи ----------
  http.get('/api/tenant/directories', async ({ request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    const blocked = subscriptionGuard(ctx.org);
    if (blocked) return blocked;
    const result: TenantDirectorySummary[] = DIRECTORIES.flatMap((d) => {
      const mode = modeOf(d.code, ctx.user, ctx.org);
      if (!mode) return [];
      const items = visibleItems(d.code, ctx.org.tenantId);
      const can = (action: DirectoryAction) => mode === 'WORK' && ctx.user.access.includes(option(d.code, action));
      const tariffModule = TARIFF_MODULE_OF[directoryModuleKey(d.code)];
      return [
        {
          code: d.code,
          name: d.name,
          count: items.length,
          mode,
          canCreate: can('create'),
          canEdit: can('edit'),
          canDelete: can('delete'),
          upgradeTariff: mode === 'DEMO' && tariffModule ? upgradeTariffFor(ctx.org, tariffModule) : null,
        },
      ];
    });
    return HttpResponse.json(result);
  }),

  // Значения для выпадающих списков в формах и фильтрах организации
  http.get('/api/tenant/directories/:code/options', async ({ params, request }) => {
    await latency();
    const ctx = tenantContext(request);
    if (ctx instanceof Response) return ctx;
    const code = String(params.code);
    if (!isDirectoryCode(code)) return err(404, 'NOT_FOUND');
    return HttpResponse.json(visibleItems(code, ctx.org.tenantId).map((i) => ({ value: i.id, label: i.nameRu, parentId: i.parentId })));
  }),

  http.get('/api/tenant/directories/:code/items', async ({ params, request }) => {
    await latency();
    const ctx = tenantDirectory(request, String(params.code), 'view');
    if (ctx instanceof Response) return ctx;
    const canEdit = ctx.user.access.includes(option(ctx.code, 'edit'));
    const canDelete = ctx.user.access.includes(option(ctx.code, 'delete'));
    return HttpResponse.json(
      visibleItems(ctx.code, ctx.org.tenantId).map((i) => toItem(i, i.tenantId === ctx.org.tenantId && (canEdit || canDelete))),
    );
  }),

  http.post('/api/tenant/directories/:code/items', async ({ params, request }) => {
    await latency();
    const ctx = tenantDirectory(request, String(params.code), 'create');
    if (ctx instanceof Response) return ctx;
    const body = (await request.json().catch(() => ({}))) as Partial<DirectoryItemPayload>;
    const fe = validate(ctx.code, body, ctx.org.tenantId);
    if (Object.keys(fe).length) return fieldsError(fe);
    return HttpResponse.json(toItem(create(ctx.code, body, ctx.org.tenantId), true), { status: 201 });
  }),

  // Глобальные и чужие записи не находятся: менять можно только записи своей организации
  http.put('/api/tenant/directories/:code/items/:id', async ({ params, request }) => {
    await latency();
    const ctx = tenantDirectory(request, String(params.code), 'edit');
    if (ctx instanceof Response) return ctx;
    const item = visibleItems(ctx.code, ctx.org.tenantId).find((i) => i.id === params.id);
    if (!item) return err(404, 'NOT_FOUND');
    if (item.tenantId === null) return err(403, 'FORBIDDEN', 'Глобальную запись нельзя изменить.');
    const body = (await request.json().catch(() => ({}))) as Partial<DirectoryItemPayload>;
    const fe = validate(ctx.code, body, ctx.org.tenantId, item.id);
    if (Object.keys(fe).length) return fieldsError(fe);
    return HttpResponse.json(toItem(update(item.id, ctx.code, body), true));
  }),

  http.delete('/api/tenant/directories/:code/items/:id', async ({ params, request }) => {
    await latency();
    const ctx = tenantDirectory(request, String(params.code), 'delete');
    if (ctx instanceof Response) return ctx;
    const item = visibleItems(ctx.code, ctx.org.tenantId).find((i) => i.id === params.id);
    if (!item) return err(404, 'NOT_FOUND');
    if (item.tenantId === null) return err(403, 'FORBIDDEN', 'Глобальную запись нельзя удалить.');
    const used = usageError(item);
    if (used) return err(400, 'VALIDATION_ERROR', `Нельзя удалить. ${used}`);
    saveDirectories(loadDirectories().filter((i) => i.id !== item.id));
    return new HttpResponse(null, { status: 204 });
  }),
];
