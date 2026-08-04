import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

export function TextField({ label, error, className = '', id, ...rest }: TextFieldProps) {
  const describedBy = error && id ? `${id}-error` : undefined;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}

      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-11 w-full rounded-xl border bg-elevated px-3 text-base text-ink outline-none placeholder:text-muted focus:border-brand ${
          error ? 'border-danger' : 'border-border'
        } ${className}`}
        {...rest}
      />

      {error && (
        <p id={describedBy} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
