import { Typography } from 'antd';
import { Check, Copy } from 'lucide-react';

interface Props {
  value: string;
  label: string;
  mono?: boolean;
}

/** Текст с кнопкой копирования. Клики не всплывают (строка таблицы не открывается). */
export function CopyText({ value, label, mono = true }: Props) {
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <Typography.Text
        className={mono ? 'mono' : undefined}
        copyable={{
          text: value,
          icon: [<Copy key="c" size={14} aria-label={`Копировать ${label}`} />, <Check key="d" size={14} />],
          tooltips: [`Копировать ${label}`, 'Скопировано'],
        }}
      >
        {value}
      </Typography.Text>
    </span>
  );
}
