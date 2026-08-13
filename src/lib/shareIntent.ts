/** Isian yang bisa diambil dari sesuatu yang dibagikan aplikasi lain. */
export interface SharedPayload {
  title: string;
  url: string;
}

const SKEMA_APLIKASI = 'id.co.dak.rakbaca';

/** Menemukan tautan pertama di dalam teks bebas. */
const POLA_URL = /https?:\/\/[^\s<>"']+/i;

/**
 * Menguraikan apa yang dikirim aplikasi lain lewat "Bagikan".
 *
 * Bentuk kirimannya tidak seragam, dan itu inti kesulitannya:
 *
 * - Chrome mengirim judul halaman di `EXTRA_SUBJECT` dan tautannya di
 *   `EXTRA_TEXT` — kasus paling rapi
 * - Banyak aplikasi hanya mengirim `EXTRA_TEXT` berisi tautan telanjang
 * - Sebagian menggabung keduanya jadi satu teks: "Judul https://…"
 *
 * Karena itu tautan dicari **di dalam** teks, bukan diasumsikan teksnya adalah
 * tautan. Sisa teks setelah tautan dibuang dipakai sebagai judul, tetapi hanya
 * kalau `EXTRA_SUBJECT` tidak ada — subjek hampir selalu lebih bersih.
 *
 * Fungsi murni, supaya bisa diuji tanpa perangkat Android.
 */
export function parseSharedPayload(text?: string | null, subject?: string | null): SharedPayload {
  const isi = (text ?? '').trim();
  const url = POLA_URL.exec(isi)?.[0] ?? '';

  // Tanda baca penutup kerap ikut terbawa saat orang menyalin tautan.
  const urlBersih = url.replace(/[),.;]+$/, '');

  const sisa = isi.replace(url, '').replace(/\s+/g, ' ').trim();
  const judul = (subject ?? '').trim() || sisa;

  return { title: judul, url: urlBersih };
}

/**
 * Membaca kiriman dari URL yang meluncurkan aplikasi.
 *
 * `MainActivity` menuliskan ulang intent ACTION_SEND menjadi tautan berskema
 * aplikasi ini, sehingga plumbing bawaan Capacitor — `getLaunchUrl` dan
 * `appUrlOpen` — yang mengantarkannya ke sini. Tanpa penulisan ulang itu,
 * ACTION_SEND tidak terlihat sama sekali dari sisi JavaScript.
 *
 * Mengembalikan `null` untuk URL yang bukan kiriman, termasuk deep link biasa.
 */
export function readSharedFromUrl(launchUrl?: string | null): SharedPayload | null {
  if (!launchUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(launchUrl);
  } catch {
    return null;
  }

  // `URL` menyimpan skema dengan titik dua di belakangnya.
  if (parsed.protocol !== `${SKEMA_APLIKASI}:`) return null;
  if (parsed.hostname !== 'bagikan') return null;

  const payload = parseSharedPayload(
    parsed.searchParams.get('teks'),
    parsed.searchParams.get('judul'),
  );

  // Kiriman kosong tidak layak membuka form — bisa terjadi kalau aplikasi
  // pengirim mengosongkan kedua medannya.
  return payload.title || payload.url ? payload : null;
}
