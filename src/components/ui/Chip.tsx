import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  children: ReactNode;
}

/** Pil kecil untuk filter dan pemilihan tag. */
export function Chip({ active = false, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors ${
        active
          ? 'border-brand bg-brand text-on-brand'
          : 'border-border bg-elevated text-muted'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

interface StaticChipProps {
  children: ReactNode;
  color?: string;
}

/** Versi non-interaktif, dipakai untuk badge di kartu dan halaman detail. */
export function StaticChip({ children, color }: StaticChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs font-medium text-muted"
    >
      {color && (
        <span
          aria-hidden="true"
          style={{ background: color }}
          className="h-2 w-2 rounded-full"
        />
      )}
      {children}
    </span>
  );
}
