import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n/useT';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Kalau diisi, tombol kembali ditampilkan dan mengarah ke sini. */
  backTo?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, action }: PageHeaderProps) {
  const t = useT();

  return (
    <div className="flex items-start gap-2">
      {backTo && (
        <Link
          to={backTo}
          aria-label={t('action.back')}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink active:bg-elevated"
        >
          <ChevronLeft size={22} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      {action}
    </div>
  );
}
