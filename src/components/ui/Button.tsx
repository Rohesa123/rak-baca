import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'md' | 'sm' | 'icon';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand active:opacity-80',
  ghost: 'bg-elevated text-ink active:bg-border',
  danger: 'bg-danger text-on-danger active:opacity-80',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
  // 44px: ukuran minimum target sentuh yang nyaman di layar HP.
  icon: 'h-11 w-11',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition-opacity select-none disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
}
