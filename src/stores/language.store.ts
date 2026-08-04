import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

export type Language = 'id' | 'en';

const STORAGE_KEY = 'language';

function isLanguage(value: string | null): value is Language {
  return value === 'id' || value === 'en';
}

interface LanguageState {
  lang: Language;
  setLang: (lang: Language) => void;
  hydrate: () => Promise<void>;
}

/**
 * Bawaannya bahasa Indonesia — bahasa asal aplikasi ini, sekaligus sumber
 * kebenaran kamusnya. Tidak menebak dari `navigator.language`: pengguna yang
 * ponselnya berbahasa Inggris belum tentu ingin antarmukanya ikut berubah.
 */
export const useLanguageStore = create<LanguageState>((set) => ({
  lang: 'id',

  setLang: (lang) => {
    set({ lang });
    void Preferences.set({ key: STORAGE_KEY, value: lang });
  },

  hydrate: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (isLanguage(value)) set({ lang: value });
    } catch {
      // Bukan hal kritis — kalau gagal dibaca, pakai bahasa bawaan.
    }
  },
}));
