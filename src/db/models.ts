/**
 * Model data v2 untuk "Rak Baca".
 *
 * Hidup berdampingan sementara dengan model v1 di `types.ts` — UI masih
 * berjalan di atas v1 sampai batch berikutnya menukarnya, lalu seluruh berkas
 * v1 dihapus.
 */

export type TaxonomyKind = 'type' | 'theme' | 'genre' | 'pubstatus';

export type ProgressUnit = 'chapter' | 'page' | 'volume' | 'episode';

export type AgeRating = 'all' | 'teen' | 'mature' | 'adult';

export const AGE_RATINGS: readonly AgeRating[] = ['all', 'teen', 'mature', 'adult'];

/**
 * Satu tabel untuk keempat sumbu, dibedakan `kind`. Menambah sumbu baru nanti
 * cukup memakai nilai `kind` baru — tidak perlu tabel maupun migrasi.
 */
export interface Taxonomy {
  id: string;
  kind: TaxonomyKind;
  name: string;
  /** Hex untuk badge. Terutama dipakai oleh genre dan status. */
  color?: string;

  // Dua field di bawah hanya berarti untuk `kind: 'type'`.

  /**
   * `false` menyembunyikan seluruh blok progres dari form dan kartu. Cerpen
   * dan artikel tidak punya progres yang berarti — sekali dibaca, selesai.
   */
  tracksProgress?: boolean;
  defaultProgressUnit?: ProgressUnit;

  createdAt: number;
}

export interface Work {
  id: string;
  /** Judul asli karya. */
  title: string;
  /** Judul versi sendiri. Default mengikuti `title` saat dibuat. */
  altTitle: string;
  author: string;

  typeId: string | null;
  themeIds: string[];
  genreIds: string[];
  pubStatusId: string | null;
  ageRating: AgeRating | null;

  synopsis?: string;
  /** Catatan pribadi. */
  notes?: string;
  /** Tautan tempat membacanya — inti dari tujuan aplikasi ini. */
  sourceUrl?: string;

  progressUnit: ProgressUnit;
  progressCurrent: number;
  /** `null` = belum tamat atau totalnya tidak diketahui. */
  progressTotal: number | null;

  /** Untuk urutan default "terakhir dibaca". */
  lastReadAt: number | null;
  /** Skor pribadi 1–10. */
  personalRating: number | null;
  /**
   * Timestamp, bukan boolean. Boolean bukan tipe kunci yang sah di IndexedDB —
   * indeksnya akan diam-diam kosong. Nilai `null` otomatis dikeluarkan dari
   * indeks, jadi indeksnya hanya berisi karya favorit.
   */
  favoritedAt: number | null;
  finishedAt: number | null;

  primaryImageId: string | null;

  /**
   * Posisi pada pengurutan manual. `undefined` berarti **belum pernah diurutkan
   * manual** — sebuah keadaan yang sah, bukan data rusak, jadi tidak ada yang
   * perlu "diperbaiki" pada pemasangan lama.
   *
   * **Sengaja tidak diindeks**, karena itu tidak menuntut versi Dexie baru
   * maupun migrasi: IndexedDB menyimpan objek utuh dan hanya medan yang
   * didaftarkan di `stores()` yang perlu diindeks. Pengurutan di aplikasi ini
   * memang dilakukan di memori, bukan lewat indeks. Beberapa medan lain
   * (`synopsis`, `notes`, `progressCurrent`) sudah lebih dulu begitu.
   */
  sortOrder?: number;

  createdAt: number;
  updatedAt: number;
}

export type ImageRole = 'cover' | 'art';

/**
 * Metadata gambar beserta thumbnail-nya. Berkas ukuran penuh sengaja disimpan
 * di tabel `imageBlobs` yang terpisah, supaya grid galeri tidak pernah
 * menyentuhnya.
 */
export interface WorkImage {
  id: string;
  workId: string;
  role: ImageRole;
  /** Teks bebas: "Volume 1", "Arc Turnamen", "Ilustrasi karakter". */
  label?: string;
  sortOrder: number;
  mimeType: string;
  width: number;
  height: number;
  thumbBlob: Blob;
  createdAt: number;
}

export interface ImageBlob {
  /** Sama dengan `WorkImage.id`. */
  id: string;
  blob: Blob;
}

/** Diturunkan dari data, tidak pernah disimpan. */
export type ReadingStatus = 'belum' | 'berjalan' | 'selesai';

export interface WorkInput {
  title: string;
  altTitle?: string;
  author?: string;
  typeId?: string | null;
  themeIds?: string[];
  genreIds?: string[];
  pubStatusId?: string | null;
  ageRating?: AgeRating | null;
  synopsis?: string;
  notes?: string;
  sourceUrl?: string;
  progressUnit?: ProgressUnit;
  progressCurrent?: number;
  progressTotal?: number | null;
  personalRating?: number | null;
}

export type WorkPatch = Partial<Omit<Work, 'id' | 'createdAt' | 'updatedAt'>>;

export type WorkSort =
  | 'lastRead'
  | 'newest'
  | 'oldest'
  | 'title'
  | 'rating'
  | 'progress'
  | 'manual';

/**
 * Medan yang disapu oleh `query`.
 *
 * Pencarian menyeluruh berguna sebagai jalur utama, tetapi menghalangi
 * pencarian yang terarah: mencari penulis "Aoyama" ikut memunculkan karya yang
 * kebetulan judulnya memuat kata itu. Pemisahan ini yang menyelesaikannya.
 */
export type SearchField = 'all' | 'title' | 'author';

export interface WorkFilters {
  /** Cakupannya ditentukan `searchField`. */
  query?: string;
  /** Bawaannya `all`, supaya perilaku lama tetap jadi jalur utama. */
  searchField?: SearchField;
  typeId?: string | null;
  /** Karya harus punya **semua** tema ini. */
  themeIds?: string[];
  /** Karya harus punya **semua** genre ini. */
  genreIds?: string[];
  /**
   * Karya yang memuat **salah satu** nilai ini disingkirkan — semantik OR,
   * bukan AND. "Kecuali A atau B" adalah cara orang berpikir tentang
   * pengecualian; menuntut keduanya hadir sekaligus hampir tidak pernah
   * berguna.
   */
  excludeThemeIds?: string[];
  excludeGenreIds?: string[];
  pubStatusId?: string | null;
  ageRating?: AgeRating;
  readingStatus?: ReadingStatus;
  favoritesOnly?: boolean;
  sort?: WorkSort;
}
