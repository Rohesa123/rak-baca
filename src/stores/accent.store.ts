import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { parseHex } from '../lib/color';

const STORAGE_KEY = 'accent-color';

/** Sama dengan token `--color-brand` bawaan di `index.css`. */
export const DEFAULT_ACCENT = '#7c3aed';

export const ACCENT_PRESETS: readonly string[] = [
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#059669',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#475569',
];

interface AccentState {
  accent: string;
  setAccent: (accent: string) => void;
  hydrate: () => Promise<void>;
}

export const useAccentStore = create<AccentState>((set) => ({
  accent: DEFAULT_ACCENT,

  setAccent: (accent) => {
    // Divalidasi di sini juga, bukan hanya di form: nilai tidak sah akan
    // membuat token CSS kosong dan seluruh tampilan rusak tanpa pesan apa pun.
    if (!parseHex(accent)) return;

    set({ accent });
    void Preferences.set({ key: STORAGE_KEY, value: accent });
  },

  hydrate: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value && parseHex(value)) set({ accent: value });
    } catch {
      // Bukan hal kritis — kalau gagal dibaca, pakai warna bawaan.
    }
  },
}));
