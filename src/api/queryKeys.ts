import type { OrganizationFilters } from './types';

export const queryKeys = {
  me: ['me'] as const,
  regions: ['regions'] as const,
  organizationUsers: (clientSlug: string) => ['organization-users', clientSlug] as const,
  platformUsers: (search: string) => ['platform-users', search] as const,
  platformUsersAll: ['platform-users'] as const,
  platformLimits: (search: string) => ['platform-limits', search] as const,
  organizations: (filters: OrganizationFilters) => ['organizations', filters] as const,
  organizationsAll: ['organizations'] as const,
  organization: (tenantId: string) => ['organization', tenantId] as const,
  tariffPlans: ['tariff-plans'] as const,
  tariffPlan: (tariffPlanId: string) => ['tariff-plan', tariffPlanId] as const,
  tenantAccess: (clientSlug: string) => ['tenant-access', clientSlug] as const,
  tenantAccessAll: ['tenant-access'] as const,
  subscriptionSummary: (clientSlug: string) => ['subscription-summary', clientSlug] as const,
  tenantModules: (clientSlug: string) => ['tenant-modules', clientSlug] as const,
  tenantUsage: (clientSlug: string) => ['tenant-usage', clientSlug] as const,
  tenantModuleData: (clientSlug: string, code: string) => ['tenant-module', clientSlug, code] as const,
};
