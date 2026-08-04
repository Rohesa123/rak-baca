import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', id, ...rest }: TextareaProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}

      <textarea
        id={id}
        rows={3}
        className={`w-full resize-y rounded-xl border border-border bg-elevated px-3 py-2.5 text-base text-ink outline-none placeholder:text-muted focus:border-brand ${className}`}
        {...rest}
      />
    </div>
  );
}
