import type { ThemeConfig } from 'antd';

/**
 * Единый источник design tokens. Те же значения передаются в Ant Design (ConfigProvider)
 * и в CSS-переменные для Tailwind (см. index.css @theme) — параллельной визуальной системы нет.
 * Брендовые значения — заглушки до согласования (ТЗ, вопрос 10). Контраст текстовых цветов ≥ WCAG AA.
 */
export const tokens = {
  // Палитра визуального языка NIS Academy
  colorPrimary: '#4f46e5',
  colorPrimaryHover: '#4338ca',
  colorPrimarySoft: '#eef2ff',
  colorSecondary: '#0ea5e9',
  colorSecondarySoft: '#e0f2fe',
  colorSuccess: '#15803d',
  colorSuccessSoft: '#dcfce7',
  colorWarning: '#b45309',
  colorWarningSoft: '#fef3c7',
  colorError: '#b91c1c',
  colorErrorSoft: '#fee2e2',
  colorInfo: '#0369a1',
  colorInfoSoft: '#e0f2fe',
  colorText: '#0f172a',
  colorTextSecondary: '#64748b',
  colorBorder: '#e2e8f0',
  colorBgPage: '#f8fafc',
  colorBgSurface: '#ffffff',
  colorBgSubtle: '#f1f5f9',
  colorSider: '#0f172a',
  colorHighlight: '#fef3c7',
  borderRadius: 8,
  borderRadiusLG: 12,
  controlHeight: 40,
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  lineHeight: 1.5715,
} as const;

export const theme: ThemeConfig = {
  token: {
    colorPrimary: tokens.colorPrimary,
    colorSuccess: tokens.colorSuccess,
    colorWarning: tokens.colorWarning,
    colorError: tokens.colorError,
    colorInfo: tokens.colorInfo,
    colorText: tokens.colorText,
    colorTextSecondary: tokens.colorTextSecondary,
    colorBorderSecondary: tokens.colorBorder,
    colorBgLayout: tokens.colorBgPage,
    colorBgContainer: tokens.colorBgSurface,
    borderRadius: tokens.borderRadius,
    borderRadiusLG: tokens.borderRadiusLG,
    controlHeight: tokens.controlHeight,
    fontFamily: tokens.fontFamily,
    lineHeight: tokens.lineHeight,
  },
  components: {
    Layout: {
      siderBg: tokens.colorSider,
      headerBg: tokens.colorBgSurface,
      bodyBg: tokens.colorBgPage,
      headerPadding: '0 24px',
      headerHeight: 64,
    },
    Menu: { darkItemBg: tokens.colorSider, darkSubMenuItemBg: tokens.colorSider, darkItemSelectedBg: tokens.colorPrimary },
    Table: { headerBg: tokens.colorBgSubtle },
    Card: { bodyPadding: 24, headerPadding: 24 },
  },
};

/** Публикует токены как CSS-переменные для Tailwind-утилит (bg-primary, text-muted, …). */
export function applyCssTokens(root: HTMLElement = document.documentElement) {
  const vars: Record<string, string> = {
    '--app-primary': tokens.colorPrimary,
    '--app-primary-hover': tokens.colorPrimaryHover,
    '--app-primary-soft': tokens.colorPrimarySoft,
    '--app-secondary': tokens.colorSecondary,
    '--app-secondary-soft': tokens.colorSecondarySoft,
    '--app-success-soft': tokens.colorSuccessSoft,
    '--app-warning-soft': tokens.colorWarningSoft,
    '--app-error-soft': tokens.colorErrorSoft,
    '--app-info': tokens.colorInfo,
    '--app-info-soft': tokens.colorInfoSoft,
    '--app-success': tokens.colorSuccess,
    '--app-warning': tokens.colorWarning,
    '--app-error': tokens.colorError,
    '--app-text': tokens.colorText,
    '--app-muted': tokens.colorTextSecondary,
    '--app-border': tokens.colorBorder,
    '--app-page': tokens.colorBgPage,
    '--app-surface': tokens.colorBgSurface,
    '--app-subtle': tokens.colorBgSubtle,
    '--app-sider': tokens.colorSider,
    '--app-highlight': tokens.colorHighlight,
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}
