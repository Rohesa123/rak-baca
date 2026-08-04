import Dexie, { type EntityTable } from 'dexie';
import type { ImageBlob, Taxonomy, Work, WorkImage } from './models';
import { seedTaxonomies } from './seed.taxonomies';

/**
 * Database v2. Sengaja **bernama lain** dari `book-wishlist` milik v1, dan
 * dimulai dari `version(1)` tanpa migrasi apa pun.
 *
 * Itu mungkin karena belum ada satu pun APK yang terpasang di lapangan, jadi
 * tidak ada data yang perlu diselamatkan — database lama cukup ditinggalkan.
 * Migrasi Dexie adalah bagian yang paling sulit diuji tanpa data sungguhan,
 * dan bug di dalamnya baru muncul di perangkat pengguna saat sudah terlambat;
 * menghindarinya sepenuhnya jauh lebih aman daripada menulisnya dengan hati-hati.
 *
 * Jendela itu tertutup begitu APK dipakai menyimpan data sungguhan. Sesudah
 * itu, setiap perubahan schema wajib lewat `version(n).upgrade()`.
 *
 * Penanda indeks: `*` multi-entry, `&` unique, `[a+b]` compound.
 */
export const db = new Dexie('rak-baca') as Dexie & {
  works: EntityTable<Work, 'id'>;
  taxonomies: EntityTable<Taxonomy, 'id'>;
  images: EntityTable<WorkImage, 'id'>;
  imageBlobs: EntityTable<ImageBlob, 'id'>;
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

db.on('populate', (tx) => {
  seedTaxonomies(tx);
});
