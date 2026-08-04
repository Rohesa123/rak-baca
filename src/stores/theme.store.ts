import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme-mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

/**
 * Preferences dipakai, bukan IndexedDB: ini satu nilai kecil, dan di Android
 * plugin ini memakai SharedPreferences yang tersedia lebih awal daripada
 * database. Di web ia jatuh ke localStorage.
 *
 * Nilai awalnya 'system' — sama dengan perilaku CSS bawaan — jadi pengguna
 * yang tidak pernah mengubah tema tidak akan melihat kedipan saat pemuatan
 * asinkron selesai.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',

  setMode: (mode) => {
    set({ mode });
    void Preferences.set({ key: STORAGE_KEY, value: mode });
  },

  hydrate: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (isThemeMode(value)) set({ mode: value });
    } catch {
      // Tema bukan hal kritis — kalau gagal dibaca, biarkan mengikuti sistem.
    }
  },
}));
