import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';
import { DEFAULT_QUALITY_PRESET } from '../lib/image';
import type { QualityPreset } from '../lib/image';

const STORAGE_KEY = 'image-quality';

function isPreset(value: string | null): value is QualityPreset {
  return value === 'tinggi' || value === 'sedang' || value === 'hemat';
}

interface ImageQualityState {
  preset: QualityPreset;
  setPreset: (preset: QualityPreset) => void;
  hydrate: () => Promise<void>;
}

/**
 * Nilai awalnya sama dengan default di `image.ts`, jadi pemuatan asinkron dari
 * Preferences tidak pernah membuat gambar terlanjur diproses dengan setelan
 * yang salah selama sepersekian detik pertama.
 */
export const useImageQualityStore = create<ImageQualityState>((set) => ({
  preset: DEFAULT_QUALITY_PRESET,

  setPreset: (preset) => {
    set({ preset });
    void Preferences.set({ key: STORAGE_KEY, value: preset });
  },

  hydrate: async () => {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (isPreset(value)) set({ preset: value });
    } catch {
      // Bukan hal kritis — kalau gagal dibaca, pakai default.
    }
  },
}));
