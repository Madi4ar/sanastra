import { useState, type ReactNode } from 'react';

/**
 * Кратковременно подсвечивает значение, когда оно меняется (real-time обновление).
 * Анимируется только фон — размеры не меняются, layout не «прыгает».
 */
export function Highlight({ value, children }: { value: unknown; children: ReactNode }) {
  const serialized = JSON.stringify(value);
  const [prev, setPrev] = useState(serialized);
  const [flash, setFlash] = useState(0);
  if (prev !== serialized) {
    setPrev(serialized);
    setFlash((n) => n + 1);
  }
  return (
    <span key={flash} className={flash ? 'value-flash' : undefined} data-flash={flash || undefined}>
      {children}
    </span>
  );
}
