import type { Transaction } from 'dexie';
import type { ProgressUnit, Taxonomy, TaxonomyKind } from './models';
import { newId } from '../lib/id';

type SeedRow = Omit<Taxonomy, 'id' | 'createdAt'>;

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
  { name: 'Komik', unit: 'chapter', tracksProgress: true },
  { name: 'Novel', unit: 'page', tracksProgress: true },
  { name: 'Novel Web', unit: 'chapter', tracksProgress: true },
  { name: 'Buku Nonfiksi', unit: 'page', tracksProgress: true },
  { name: 'Buku Anak', unit: 'page', tracksProgress: true },
  { name: 'Karya Ilmiah', unit: 'page', tracksProgress: true },
  { name: 'Cerpen', unit: 'page', tracksProgress: false },
  { name: 'Artikel', unit: 'page', tracksProgress: false },
];

/** Status terbit. "Dikapak" = dihentikan sebelum tamat (istilah fandom: axed). */
const PUB_STATUSES: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Ongoing', color: '#10b981' },
  { name: 'Tamat', color: '#0ea5e9' },
  { name: 'Hiatus', color: '#f59e0b' },
  { name: 'Dikapak', color: '#ef4444' },
];

/** Genre menjawab "rasanya seperti apa". */
const GENRES: readonly string[] = [
  'Aksi',
  'Petualangan',
  'Komedi',
  'Drama',
  'Fantasi',
  'Horor',
  'Misteri',
  'Romansa',
  'Sci-Fi',
  'Slice of Life',
  'Olahraga',
  'Psikologis',
  'Edukasi',
];

/** Tema menjawab "tentang apa". */
const THEMES: readonly string[] = [
  'Isekai',
  'Sekolah',
  'Reinkarnasi',
  'Regresi',
  'Kultivasi',
  'Sistem',
  'Dungeon',
  'Militer',
  'Memasak',
  'Musik',
  'Villainess',
  'Sejarah',
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
