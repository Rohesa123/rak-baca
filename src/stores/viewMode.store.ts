import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

const STORAGE_KEY = 'view-mode';

/**
 * Tiga mode, bukan delapan seperti File Explorer.
 *
 * Yang benar-benar berbeda di aplikasi ini hanya satu sumbu: berapa banyak yang
 * terlihat sekaligus, dan seberapa banyak informasi per barisnya. Tingkatan
 * ukuran ikon dan varian tabel berkolom adalah warisan desktop yang tidak punya
 * arti di layar selebar telapak tangan.
 */
export type ViewMode = 'kartu' | 'ringkas' | 'sampul';

export const VIEW_MODES: readonly ViewMode[] = ['kartu', 'ringkas', 'sampul'];

function isMode(value: string | null): value is ViewMode {
  return value === 'kartu' || value === 'ringkas' || value === 'sampul';
}

interface ViewModeState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  hydrate: () => Promise<void>;
}

/**
 * Preferensi tampilan, bukan data koleksi — karena itu disimpan di Preferences,
 * tidak ikut terekspor, dan tidak menyentuh schema sama sekali.
 */
export const useViewModeStore = create<ViewModeState>((set) => ({
  mode: 'kartu',

  setMode: (mode) => {
    set({ mode });
    void Preferences.set({ key: STORAGE_KEY, value: mode });
  },

  hydrate: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (isMode(value)) set({ mode: value });
    } catch {
      // Bukan hal kritis — kalau gagal dibaca, pakai default.
    }
  },
}));
