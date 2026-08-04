import { useEffect, useState } from 'react';
import { useThemeStore } from '../stores/theme.store';
import type { ThemeMode } from '../stores/theme.store';
import { useAccentStore } from '../stores/accent.store';
import { adaptForDark, parseHex, readableTextOn, toHex } from '../lib/color';
import { applyStatusBarTheme } from '../lib/native';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_QUERY).matches;
}

function resolveDark(mode: ThemeMode, systemDark: boolean): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemDark;
}

/**
 * Menerapkan pilihan tema ke `<html data-theme>`, menyetel warna aksen, dan
 * menyelaraskan status bar Android. Dipanggil sekali dari Layout.
 *
 * Atribut `data-theme` hanya dipasang saat pengguna memilih terang atau gelap
 * secara eksplisit. Untuk mode 'system' atributnya dilepas, sehingga CSS
 * kembali sepenuhnya ke `@media (prefers-color-scheme)`.
 */
export function useTheme(): void {
  const mode = useThemeStore((state) => state.mode);
  const hydrateTheme = useThemeStore((state) => state.hydrate);
  const accent = useAccentStore((state) => state.accent);
  const hydrateAccent = useAccentStore((state) => state.hydrate);

  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    void hydrateTheme();
    void hydrateAccent();
  }, [hydrateTheme, hydrateAccent]);

  // Mode 'system' harus ikut berubah saat pengaturan perangkat diubah selagi
  // aplikasi terbuka, bukan hanya saat pertama dimuat.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const dark = resolveDark(mode, systemDark);

    if (mode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }

    const parsed = parseHex(accent);
    if (parsed) {
      // Dicerahkan dulu kalau perlu, baru warna teksnya dihitung — supaya
      // kontrasnya diukur terhadap warna yang benar-benar tampil.
      const effective = dark ? adaptForDark(parsed) : parsed;
      root.style.setProperty('--color-brand', toHex(effective));
      root.style.setProperty('--color-on-brand', readableTextOn(effective));
    }

    void applyStatusBarTheme(dark);
  }, [mode, systemDark, accent]);
}
