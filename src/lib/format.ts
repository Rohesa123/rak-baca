/**
 * Ukuran berkas dalam satuan yang enak dibaca.
 *
 * Dipakai layar Pengaturan maupun laporan keutuhan data — angka "12 MB" jauh
 * lebih bisa ditindaklanjuti daripada "12.582.912 byte".
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
