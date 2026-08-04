import type { Transaction } from 'dexie';
import type { ProgressUnit, Taxonomy, TaxonomyKind } from './models';
import { newId } from '../lib/id';

type SeedRow = Omit<Taxonomy, 'id' | 'createdAt'>;

/**
 * Nilai bawaan sengaja berbahasa Inggris di kedua bahasa antarmuka.
 *
 * Alasannya: ini **data**, bukan pesan antarmuka. Begitu pengguna mengubah
 * namanya, nilai itu jadi miliknya dan tidak boleh ikut berganti saat bahasa
 * aplikasi diganti — sementara menerjemahkan nilai bawaan saja akan membuat
 * separuh daftar berpindah bahasa dan separuhnya tidak. Inggris dipilih karena
 * netral dan terbaca sebagai "bawaan pabrik" yang memang untuk disesuaikan.
 * Sebagian besar istilahnya (Manga, Isekai, Hiatus) juga sudah dipakai apa
 * adanya oleh pembaca Indonesia.
 */

/**
 * Tipe karya bawaan. `tracksProgress` sengaja dimatikan untuk bentuk yang
 * sekali baca selesai — cerpen dan artikel tidak punya chapter maupun halaman
 * yang berarti untuk dilacak, dan menampilkan "Ch. 0 / ?" di sana hanya derau.
 */
const TYPES: ReadonlyArray<{
  name: string;
  unit: ProgressUnit;
  tracksProgress: boolean;
}> = [
  { name: 'Manga', unit: 'chapter', tracksProgress: true },
  { name: 'Manhwa', unit: 'chapter', tracksProgress: true },
  { name: 'Manhua', unit: 'chapter', tracksProgress: true },
  { name: 'Comic', unit: 'chapter', tracksProgress: true },
  { name: 'Novel', unit: 'page', tracksProgress: true },
  { name: 'Web Novel', unit: 'chapter', tracksProgress: true },
  { name: 'Non-fiction', unit: 'page', tracksProgress: true },
  { name: "Children's Book", unit: 'page', tracksProgress: true },
  { name: 'Academic Paper', unit: 'page', tracksProgress: true },
  { name: 'Short Story', unit: 'page', tracksProgress: false },
  { name: 'Article', unit: 'page', tracksProgress: false },
];

/** Status terbit. "Axed" = dihentikan penerbit sebelum tamat, istilah fandom. */
const PUB_STATUSES: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Ongoing', color: '#10b981' },
  { name: 'Completed', color: '#0ea5e9' },
  { name: 'Hiatus', color: '#f59e0b' },
  { name: 'Axed', color: '#ef4444' },
];

/** Genre menjawab "rasanya seperti apa". */
const GENRES: readonly string[] = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Psychological',
  'Educational',
  'Thriller',
  'Supernatural',
  'Tragedy',
  'Detective',
  'Parody',
  'Martial Arts',
  'Mecha',
];

/** Tema menjawab "tentang apa". */
const THEMES: readonly string[] = [
  'Isekai',
  'School',
  'Reincarnation',
  'Regression',
  'Cultivation',
  'System',
  'Dungeon',
  'Military',
  'Cooking',
  'Music',
  'Villainess',
  'Historical',
  'Revenge',
  'Royalty',
  'Magic Academy',
  'Apocalypse',
  'Politics',
  'Idol',
  'Transmigration',
  'Harem',
];

function buildRows(): SeedRow[] {
  const rows: SeedRow[] = [];

  for (const type of TYPES) {
    rows.push({
      kind: 'type',
      name: type.name,
      tracksProgress: type.tracksProgress,
      defaultProgressUnit: type.unit,
    });
  }

  for (const status of PUB_STATUSES) {
    rows.push({ kind: 'pubstatus', name: status.name, color: status.color });
  }

  const simple = (kind: TaxonomyKind, names: readonly string[]) =>
    names.forEach((name) => rows.push({ kind, name }));

  simple('genre', GENRES);
  simple('theme', THEMES);

  return rows;
}

/**
 * Dipanggil dari event `populate` Dexie, yang hanya berjalan sekali saat
 * database pertama kali dibuat. Kalau pengguna menghapus nilai bawaan,
 * fungsi ini sengaja tidak mengembalikannya.
 */
export function seedTaxonomies(tx: Transaction): void {
  const now = Date.now();

  const rows: Taxonomy[] = buildRows().map((row, index) => ({
    ...row,
    id: newId(),
    // Offset per baris supaya urutan createdAt stabil, bukan identik semua.
    createdAt: now + index,
  }));

  void tx.table<Taxonomy>('taxonomies').bulkAdd(rows);
}
