import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

export type FilterState = 'off' | 'include' | 'exclude';

interface FilterChipProps {
  state: FilterState;
  onCycle: () => void;
  children: ReactNode;
}

const STYLES: Record<FilterState, string> = {
  off: 'border-border bg-elevated text-muted',
  include: 'border-brand bg-brand text-on-brand',
  // Merah dengan ikon minus, bukan sekadar warna lain: keadaan "dikecualikan"
  // harus terbaca berbeda secara mendasar dari "termasuk", termasuk oleh orang
  // yang sulit membedakan warna.
  exclude: 'border-danger bg-danger text-on-danger line-through',
};

/**
 * Chip filter tiga keadaan yang berputar saat diketuk: netral → termasuk →
 * dikecualikan → netral.
 *
 * Dipilih daripada dua daftar chip terpisah karena daftar terpisah
 * menggandakan panjang panel filter, padahal keduanya berbicara tentang nilai
 * yang sama persis.
 */
export function FilterChip({ state, onCycle, children }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={state !== 'off'}
      onClick={onCycle}
      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors ${STYLES[state]}`}
    >
      {state === 'include' && <Check size={13} aria-hidden="true" />}
      {state === 'exclude' && <Minus size={13} aria-hidden="true" />}
      {children}
    </button>
  );
}
