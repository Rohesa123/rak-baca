import Dexie, { type EntityTable } from 'dexie';
import type { ImageBlob, ReadingLogEntry, Taxonomy, Work, WorkImage } from './models';
import { seedTaxonomies } from './seed.taxonomies';

/**
 * ============================================================================
 * JANGAN UBAH SCHEMA DI BAWAH INI TANPA DIDISKUSIKAN LEBIH DULU.
 * ============================================================================
 *
 * Sejak v1.0.0 dirilis, aplikasi ini sudah terpasang dan menyimpan data
 * sungguhan di perangkat — milik pengembang sendiri maupun siapa pun yang
 * mengunduh APK-nya. Data itu **tidak ada salinannya di mana pun** —
 * tidak ada server, tidak ada sinkronisasi, tidak ada cadangan otomatis. Kalau
 * sebuah perubahan schema merusaknya, tidak ada yang bisa memulihkan.
 *
 * Konsekuensinya, mulai sekarang setiap perubahan bentuk data wajib:
 *
 *   1. Naik ke `db.version(n + 1)`, tidak pernah menyunting `version(1)`
 *   2. Menyediakan `.upgrade()` yang memindahkan data lama ke bentuk baru
 *   3. Diuji terhadap database yang sudah berisi, bukan database kosong
 *
 * Menyunting string `stores()` di bawah tanpa menaikkan nomor versi adalah
 * kesalahan yang paling mudah dilakukan dan paling mahal akibatnya: Dexie akan
 * menolak membuka database milik pengguna lama, dan aplikasi gagal dijalankan
 * pada perangkat yang justru paling banyak datanya.
 *
 * ---
 *
 * Sejarahnya, untuk konteks. Database ini sengaja **bernama lain** dari
 * `book-wishlist` milik v1 dan dimulai dari `version(1)` tanpa migrasi apa pun.
 * Itu boleh dilakukan saat itu karena belum ada satu pun APK di lapangan, jadi
 * tidak ada data yang perlu diselamatkan — database lama cukup ditinggalkan.
 * Migrasi Dexie adalah bagian yang paling sulit diuji tanpa data sungguhan, dan
 * bugnya baru muncul di perangkat pengguna saat sudah terlambat; menghindarinya
 * sepenuhnya lebih aman daripada menulisnya dengan hati-hati.
 *
 * Kemewahan itu sudah habis. Jendelanya tertutup di v1.0.0.
 *
 * Penanda indeks: `*` multi-entry, `&` unique, `[a+b]` compound.
 */
export const db = new Dexie('rak-baca') as Dexie & {
  works: EntityTable<Work, 'id'>;
  taxonomies: EntityTable<Taxonomy, 'id'>;
  images: EntityTable<WorkImage, 'id'>;
  imageBlobs: EntityTable<ImageBlob, 'id'>;
  readingLog: EntityTable<ReadingLogEntry, 'id'>;
};

db.version(1).stores({
  works:
    'id, title, altTitle, author, typeId, *themeIds, *genreIds, pubStatusId, ' +
    'ageRating, lastReadAt, personalRating, favoritedAt, finishedAt, ' +
    'primaryImageId, createdAt',

  // `&[kind+name]` mencegah dua genre bernama sama, tapi tetap membolehkan
  // sebuah tema dan sebuah genre yang kebetulan bernama sama.
  taxonomies: 'id, kind, name, &[kind+name], createdAt',

  images: 'id, workId, [workId+role], role, sortOrder',

  // Berkas ukuran penuh dipisah supaya grid galeri hanya membaca thumbnail.
  imageBlobs: 'id',
});

/**
 * Versi 2 — riwayat baca.
 *
 * **Migrasi pertama sejak v1.0.0, dan sengaja dipilih bentuk yang paling aman:
 * menambah tabel, bukan mengubah yang sudah ada.**
 *
 * Hanya tabel yang berubah yang perlu didaftarkan di sini; Dexie membawa serta
 * seluruh tabel v1 apa adanya. Karena tidak ada data yang berubah bentuk,
 * `.upgrade()` tidak diperlukan sama sekali — tidak satu baris pun data lama
 * yang disentuh, dan pemasangan lama membuka database yang sama seperti biasa.
 *
 * `version(1)` di atas tidak boleh disunting, sekarang maupun nanti. Menyunting
 * versi lama membuat Dexie menolak membuka database milik pengguna yang belum
 * memperbarui.
 *
 * `[workId+at]` dipakai untuk mengambil riwayat satu karya secara terurut
 * tanpa memindai seluruh tabel.
 */
db.version(2).stores({
  readingLog: 'id, workId, at, [workId+at]',
});

db.on('populate', (tx) => {
  seedTaxonomies(tx);
});
