import { readingStatus } from '../db/works.repo';
import type { ProgressUnit, ReadingStatus, Taxonomy, Work } from '../db/models';

export interface Tally {
  name: string;
  count: number;
}

export interface CollectionStats {
  total: number;
  favorites: number;
  /** Berapa karya yang sudah diberi skor, dan rata-ratanya. */
  rated: number;
  averageRating: number | null;
  /** Jumlah per status baca. `null` untuk tipe yang tidak melacak progres. */
  byStatus: Record<ReadingStatus, number>;
  untracked: number;
  /** Total progres, dipisah per satuan — chapter dan halaman tidak bisa dijumlahkan. */
  progressByUnit: Array<{ unit: ProgressUnit; total: number }>;
  finishedThisYear: number;
  topTypes: Tally[];
  topGenres: Tally[];
  topThemes: Tally[];
}

const BATAS_TERATAS = 5;

function teratas(hitungan: Map<string, number>, byId: Map<string, Taxonomy>): Tally[] {
  return [...hitungan.entries()]
    .map(([id, count]) => ({ name: byId.get(id)?.name ?? '?', count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, BATAS_TERATAS);
}

/**
 * Menghitung ringkasan koleksi.
 *
 * Fungsi murni: menerima data dan mengembalikan angka, tanpa menyentuh database
 * maupun jam sistem sendiri. Waktu dilewatkan sebagai argumen supaya
 * "selesai tahun ini" bisa diuji tanpa menunggu pergantian tahun.
 */
export function computeStats(
  works: Work[],
  taxonomies: Taxonomy[],
  now = Date.now(),
): CollectionStats {
  const byId = new Map(taxonomies.map((row) => [row.id, row]));
  const tahunIni = new Date(now).getFullYear();

  const byStatus: Record<ReadingStatus, number> = { belum: 0, berjalan: 0, selesai: 0 };
  let untracked = 0;
  let favorites = 0;
  let ratingTotal = 0;
  let rated = 0;
  let finishedThisYear = 0;

  // Dipisah per satuan karena menjumlahkan chapter dengan halaman menghasilkan
  // angka yang terlihat berarti padahal tidak berarti apa-apa.
  const perUnit = new Map<ProgressUnit, number>();
  const perType = new Map<string, number>();
  const perGenre = new Map<string, number>();
  const perTheme = new Map<string, number>();

  const bump = (map: Map<string, number>, id: string) =>
    map.set(id, (map.get(id) ?? 0) + 1);

  for (const work of works) {
    const type = work.typeId ? byId.get(work.typeId) : null;
    const status = readingStatus(work, type);

    if (status === null) untracked += 1;
    else byStatus[status] += 1;

    if (work.favoritedAt) favorites += 1;

    if (work.personalRating !== null) {
      rated += 1;
      ratingTotal += work.personalRating;
    }

    if (work.finishedAt && new Date(work.finishedAt).getFullYear() === tahunIni) {
      finishedThisYear += 1;
    }

    // Tipe yang tidak melacak progres tidak ikut dijumlahkan; angkanya selalu
    // nol dan hanya mengencerkan totalnya.
    if (type?.tracksProgress !== false && work.progressCurrent > 0) {
      perUnit.set(work.progressUnit, (perUnit.get(work.progressUnit) ?? 0) + work.progressCurrent);
    }

    if (work.typeId) bump(perType, work.typeId);
    work.genreIds.forEach((id) => bump(perGenre, id));
    work.themeIds.forEach((id) => bump(perTheme, id));
  }

  return {
    total: works.length,
    favorites,
    rated,
    averageRating: rated === 0 ? null : ratingTotal / rated,
    byStatus,
    untracked,
    progressByUnit: [...perUnit.entries()]
      .map(([unit, total]) => ({ unit, total }))
      .sort((a, b) => b.total - a.total),
    finishedThisYear,
    topTypes: teratas(perType, byId),
    topGenres: teratas(perGenre, byId),
    topThemes: teratas(perTheme, byId),
  };
}
