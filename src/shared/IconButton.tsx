import { Button, Tooltip, type ButtonProps } from 'antd';
import type { ReactNode } from 'react';

interface Props extends Omit<ButtonProps, 'icon' | 'children'> {
  label: string;
  icon: ReactNode;
}

/** Кнопка только с иконкой: всегда aria-label + tooltip, область нажатия ≥ 32×32. */
export function IconButton({ label, icon, ...rest }: Props) {
  return (
    <Tooltip title={label}>
      <Button aria-label={label} icon={icon} style={{ minWidth: 32, minHeight: 32 }} {...rest} />
    </Tooltip>
  );
}
