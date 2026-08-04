import type { ReactNode, SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

/**
 * Sengaja memakai `<select>` bawaan, bukan dropdown custom: di Android, select
 * native membuka picker sistem yang jauh lebih enak dipakai dengan jempol
 * daripada daftar melayang yang digulir sendiri.
 */
export function Select({ label, className = '', id, children, ...rest }: SelectProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}

      <select
        id={id}
        className={`h-11 w-full rounded-xl border border-border bg-elevated px-3 text-base text-ink outline-none focus:border-brand ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
