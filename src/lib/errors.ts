/**
 * Dexie melempar error dengan `name = 'ConstraintError'` saat unique index
 * dilanggar — dipakai untuk membedakan "nama sudah dipakai" dari kegagalan
 * penyimpanan yang sesungguhnya.
 */
export function isConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConstraintError';
}

/**
 * Izin galeri ditolak. `permanent` menandai keadaan yang tidak bisa lagi
 * dipulihkan dari dalam aplikasi: Android berhenti menampilkan dialog izin
 * setelah pengguna menolak dua kali, sehingga menawarkan "coba lagi" hanya
 * akan membuat tombol tampak rusak. Untuk keadaan itu satu-satunya jalan
 * adalah pengaturan sistem, dan pesannya harus mengatakan begitu.
 */
export class GalleryPermissionError extends Error {
  readonly permanent: boolean;

  constructor(permanent: boolean) {
    super('Gallery permission denied');
    // Di-set eksplisit supaya pemanggil bisa mengenalinya lewat `name` tanpa
    // mengimpor kelasnya — modul yang memuatnya bisa saja dimuat dinamis.
    this.name = 'GalleryPermissionError';
    this.permanent = permanent;
  }
}

export function isGalleryPermissionError(
  error: unknown,
): error is GalleryPermissionError {
  return error instanceof Error && error.name === 'GalleryPermissionError';
}
