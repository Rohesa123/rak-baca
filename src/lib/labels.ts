import type {
  AgeRating,
  ProgressUnit,
  ReadingStatus,
  SearchField,
  TaxonomyKind,
  WorkSort,
} from '../db/models';
import type { MessageKey } from '../i18n/messages';

/**
 * Berisi *kunci pesan*, bukan teks jadi. Teksnya baru dibentuk di komponen
 * lewat `t()`, sehingga daftar-daftar ini tidak perlu tahu bahasa apa yang
 * sedang aktif dan tetap bisa dipakai di luar React.
 */

export const PROGRESS_UNIT_KEY: Record<ProgressUnit, MessageKey> = {
  chapter: 'unit.chapter',
  page: 'unit.page',
  volume: 'unit.volume',
  episode: 'unit.episode',
};

/** Versi pendek untuk kartu, mis. "Ch. 45 / 120". */
export const PROGRESS_UNIT_SHORT_KEY: Record<ProgressUnit, MessageKey> = {
  chapter: 'unit.chapter.short',
  page: 'unit.page.short',
  volume: 'unit.volume.short',
  episode: 'unit.episode.short',
};

export const PROGRESS_UNITS: readonly ProgressUnit[] = [
  'chapter',
  'page',
  'volume',
  'episode',
];

export const AGE_RATING_KEY: Record<AgeRating, MessageKey> = {
  all: 'age.all',
  teen: 'age.teen',
  mature: 'age.mature',
  adult: 'age.adult',
};

export const READING_STATUS_KEY: Record<ReadingStatus, MessageKey> = {
  belum: 'readingStatus.belum',
  berjalan: 'readingStatus.berjalan',
  selesai: 'readingStatus.selesai',
};

export const READING_STATUSES: readonly ReadingStatus[] = [
  'belum',
  'berjalan',
  'selesai',
];

export const SORT_KEY: Record<WorkSort, MessageKey> = {
  lastRead: 'sort.lastRead',
  newest: 'sort.newest',
  oldest: 'sort.oldest',
  title: 'sort.title',
  rating: 'sort.rating',
  progress: 'sort.progress',
  manual: 'sort.manual',
};

export const SORTS: readonly WorkSort[] = [
  'lastRead',
  'newest',
  'oldest',
  'title',
  'rating',
  'progress',
  'manual',
];

export const SEARCH_FIELDS: readonly SearchField[] = ['all', 'title', 'author'];

export const SEARCH_FIELD_LABEL: Record<SearchField, MessageKey> = {
  all: 'works.searchIn.all',
  title: 'works.searchIn.title',
  author: 'works.searchIn.author',
};

/**
 * Placeholder ikut berganti mengikuti cakupan yang dipilih. Tanpa itu kotaknya
 * tetap menjanjikan "judul, penulis, sinopsis, catatan" padahal hanya penulis
 * yang benar-benar disapu — petunjuk yang keliru lebih buruk daripada tidak ada.
 */
export const SEARCH_FIELD_PLACEHOLDER: Record<SearchField, MessageKey> = {
  all: 'works.searchPlaceholder',
  title: 'works.searchPlaceholder.title',
  author: 'works.searchPlaceholder.author',
};

export const TAXONOMY_KIND_KEY: Record<TaxonomyKind, MessageKey> = {
  type: 'taxonomy.type',
  theme: 'taxonomy.theme',
  genre: 'taxonomy.genre',
  pubstatus: 'taxonomy.pubstatus',
};

export const TAXONOMY_KIND_HINT_KEY: Record<TaxonomyKind, MessageKey> = {
  type: 'taxonomy.type.hint',
  theme: 'taxonomy.theme.hint',
  genre: 'taxonomy.genre.hint',
  pubstatus: 'taxonomy.pubstatus.hint',
};

export const TAXONOMY_KINDS: readonly TaxonomyKind[] = [
  'type',
  'genre',
  'theme',
  'pubstatus',
];

/**
 * "Ch. 45 / 120", atau "Ch. 45" kalau totalnya tidak diketahui. Satuannya
 * diterima sebagai teks yang sudah diterjemahkan, bukan sebagai kode, supaya
 * fungsi ini tetap murni.
 */
export function formatProgress(
  shortUnit: string,
  current: number,
  total: number | null,
): string {
  return total === null ? `${shortUnit} ${current}` : `${shortUnit} ${current} / ${total}`;
}
