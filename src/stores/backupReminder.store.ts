import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

const KEY_LAST = 'backup.lastAt';
const KEY_ENABLED = 'backup.remind';
const KEY_SNOOZE = 'backup.snoozeUntil';

const HARI = 24 * 60 * 60 * 1000;

/** Ambang sebelum pengingat muncul. Angka awal, patut ditinjau setelah dipakai. */
export const AMBANG_HARI = 30;

/** Lama penundaan saat pengguna menekan "nanti". */
const SNOOZE_HARI = 7;

interface BackupReminderState {
  lastBackupAt: number | null;
  enabled: boolean;
  snoozedUntil: number | null;

  recordBackup: () => void;
  setEnabled: (enabled: boolean) => void;
  snooze: () => void;
  hydrate: () => Promise<void>;
}

/**
 * Pengingat cadangan.
 *
 * Risiko terbesar aplikasi ini adalah kehilangan data permanen, dan sampai
 * sekarang tidak ada apa pun yang menjaganya — satu-satunya jaring pengaman
 * menuntut pengguna mengingat sendiri untuk menekan tombol ekspor. Mengandalkan
 * ingatan untuk sesuatu yang konsekuensinya permanen adalah rancangan yang
 * buruk.
 *
 * Disimpan di Preferences, bukan Dexie: ini preferensi, bukan data koleksi, dan
 * karenanya juga tidak ikut terekspor.
 */
export const useBackupReminderStore = create<BackupReminderState>((set) => ({
  lastBackupAt: null,
  enabled: true,
  snoozedUntil: null,

  recordBackup: () => {
    const now = Date.now();
    // Penundaan ikut dibatalkan: setelah benar-benar mencadangkan, hitungannya
    // mulai dari nol lagi dan penundaan lama tidak lagi berarti apa-apa.
    set({ lastBackupAt: now, snoozedUntil: null });
    void Preferences.set({ key: KEY_LAST, value: String(now) });
    void Preferences.remove({ key: KEY_SNOOZE });
  },

  setEnabled: (enabled) => {
    set({ enabled });
    void Preferences.set({ key: KEY_ENABLED, value: enabled ? '1' : '0' });
  },

  snooze: () => {
    const until = Date.now() + SNOOZE_HARI * HARI;
    set({ snoozedUntil: until });
    void Preferences.set({ key: KEY_SNOOZE, value: String(until) });
  },

  hydrate: async () => {
    try {
      const [last, enabled, snooze] = await Promise.all([
        Preferences.get({ key: KEY_LAST }),
        Preferences.get({ key: KEY_ENABLED }),
        Preferences.get({ key: KEY_SNOOZE }),
      ]);

      set({
        lastBackupAt: last.value ? Number(last.value) : null,
        // Menyala secara bawaan. Hanya nilai '0' yang mematikannya, sehingga
        // kunci yang belum pernah ditulis tidak diam-diam menonaktifkan
        // pengingat pada pemasangan lama.
        enabled: enabled.value !== '0',
        snoozedUntil: snooze.value ? Number(snooze.value) : null,
      });
    } catch {
      // Bukan hal kritis — kalau gagal dibaca, pakai default.
    }
  },
}));

export interface ReminderInput {
  lastBackupAt: number | null;
  enabled: boolean;
  snoozedUntil: number | null;
  /** `createdAt` karya tertua. `null` kalau koleksinya kosong. */
  oldestWorkAt: number | null;
  now?: number;
}

/**
 * Berapa hari sejak cadangan terakhir, atau `null` kalau pengingat tidak layak
 * ditampilkan.
 *
 * Ditulis sebagai fungsi murni supaya bisa diuji tanpa menyentuh Preferences
 * maupun database.
 *
 * Kalau belum pernah mencadangkan sama sekali, patokannya karya **tertua** —
 * bukan saat aplikasi dipasang. Itu menjawab pertanyaan yang sebenarnya:
 * "sudah berapa lama data ini ada tanpa salinan". Memakai waktu pemasangan
 * menuntut menyimpan satu nilai lagi tanpa menjawab lebih baik.
 */
export function hariTanpaCadangan({
  lastBackupAt,
  enabled,
  snoozedUntil,
  oldestWorkAt,
  now = Date.now(),
}: ReminderInput): number | null {
  if (!enabled) return null;
  // Tidak ada gunanya mengingatkan orang mencadangkan sesuatu yang belum ada.
  if (oldestWorkAt === null) return null;
  if (snoozedUntil !== null && now < snoozedUntil) return null;

  const patokan = lastBackupAt ?? oldestWorkAt;
  const hari = Math.floor((now - patokan) / HARI);

  return hari >= AMBANG_HARI ? hari : null;
}
