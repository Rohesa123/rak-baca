import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useThemeStore } from '../../stores/theme.store';
import type { ThemeMode } from '../../stores/theme.store';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/messages';

/** Urutan siklus saat tombol ditekan berulang. */
const CYCLE: ThemeMode[] = ['system', 'light', 'dark'];

const APPEARANCE: Record<ThemeMode, { Icon: LucideIcon; key: MessageKey }> = {
  system: { Icon: Monitor, key: 'settings.theme.system' },
  light: { Icon: Sun, key: 'settings.theme.light' },
  dark: { Icon: Moon, key: 'settings.theme.dark' },
};

/**
 * Sakelar cepat di header. Tiga pilihan eksplisit tetap ada di Pengaturan —
 * keduanya membaca store yang sama, jadi tidak ada state ganda yang bisa
 * saling bertentangan.
 */
export function ThemeToggle() {
  const t = useT();
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  const { Icon, key } = APPEARANCE[mode];

  return (
    <button
      type="button"
      // Label menyebut keadaan sekarang, bukan tujuan berikutnya: pembaca layar
      // perlu tahu tema apa yang sedang aktif, dan siklusnya sendiri sudah
      // terlihat dari ikon yang berubah.
      aria-label={`${t('settings.theme')}: ${t(key)}`}
      onClick={() => setMode(CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length])}
      className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted active:bg-elevated"
    >
      <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
