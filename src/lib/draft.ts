import { Preferences } from '@capacitor/preferences';
import type { WorkFormValues } from '../components/work/WorkForm';

const STORAGE_KEY = 'rak-baca.draft.newWork';

/**
 * Draf isian karya baru.
 *
 * **Kenapa Preferences, bukan tabel Dexie.** Draf belum jadi data — ia isian
 * setengah jadi yang belum pernah pengguna simpan. Menaruhnya di database
 * berarti menaikkan versi schema beserta migrasinya, dan sejak v1.0.0 setiap
 * perubahan schema menyentuh data sungguhan milik orang. Terlalu mahal untuk
 * sesuatu yang umurnya beberapa menit. Ia juga tidak ikut terekspor, karena
 * cadangan berisi koleksi, bukan pekerjaan yang belum selesai.
 *
 * **Kenapa disimpan sama sekali, bukan sekadar ditahan di memori.** Menahan di
 * state React memang cukup untuk kasus salah tekan menu, tapi tidak menolong
 * saat Android menutup aplikasi latar belakang — dan untuk aplikasi catatan
 * tanpa cadangan, justru di situ kehilangan paling terasa.
 *
 * **Satu slot saja, dan hanya untuk karya baru.** Draf ganda menuntut antarmuka
 * pengelola draf tersendiri, dan itu fitur lain. Form sunting tidak memakai ini
 * karena data aslinya masih utuh; yang dipertaruhkan di sana hanya perubahan
 * yang belum disimpan.
 */
export const draftStore = {
  async save(values: WorkFormValues): Promise<void> {
    try {
      await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(values) });
    } catch {
      // Gagal menyimpan draf tidak boleh mengganggu pengisian form. Kalau
      // penyimpanan penuh atau ditolak, pengguna tetap bisa menyimpan karyanya
      // seperti biasa — draf hanya jaring pengaman tambahan.
    }
  },

  async load(): Promise<WorkFormValues | null> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      return value ? (JSON.parse(value) as WorkFormValues) : null;
    } catch {
      // Termasuk JSON rusak dari versi lama. Draf yang tidak terbaca
      // diperlakukan sebagai tidak ada, bukan sebagai error yang perlu
      // ditampilkan — pengguna tidak bisa berbuat apa-apa dengan pesan itu.
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await Preferences.remove({ key: STORAGE_KEY });
    } catch {
      // Sama seperti di atas: kegagalan di sini tidak berakibat apa pun selain
      // draf basi yang akan ditawarkan sekali lagi.
    }
  },
};

/**
 * Draf yang isinya sama saja dengan form kosong tidak layak ditawarkan —
 * menawarkan "lanjutkan draf?" untuk form yang belum diketik apa-apa hanya
 * derau. Nilai bawaan seperti satuan progres dan `progressCurrent: '0'`
 * sengaja diabaikan karena terisi sendiri tanpa campur tangan pengguna.
 */
export function draftHasContent(values: WorkFormValues): boolean {
  return Boolean(
    values.title.trim() ||
      values.altTitle.trim() ||
      values.author.trim() ||
      values.sourceUrl.trim() ||
      values.synopsis.trim() ||
      values.notes.trim() ||
      values.typeId ||
      values.pubStatusId ||
      values.ageRating ||
      values.genreIds.length ||
      values.themeIds.length ||
      values.personalRating.trim() ||
      values.progressTotal.trim() ||
      // `0` adalah bawaan, jadi hanya nilai selain itu yang menandakan pengguna
      // benar-benar mengisi progres.
      (values.progressCurrent.trim() !== '' && values.progressCurrent.trim() !== '0'),
  );
}
