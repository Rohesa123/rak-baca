import { readingStatus } from '../db/works.repo';
import type {
  ProgressUnit,
  ReadingLogEntry,
  ReadingStatus,
  Taxonomy,
  Work,
} from '../db/models';

export interface Tally {
  name: string;
  count: number;
}

export interface ReadingActivity {
  /** Total per satuan dalam 7 dan 30 hari terakhir. */
  last7: Array<{ unit: ProgressUnit; total: number }>;
  last30: Array<{ unit: ProgressUnit; total: number }>;
  /** Hari berturut-turut membaca, dihitung mundur dari hari ini. */
  streak: number;
  /** Berapa hari berbeda yang punya catatan sama sekali. */
  activeDays: number;
  /** `false` kalau belum ada satu pun catatan — bedakan dari "nol chapter". */
  hasHistory: boolean;
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
  activity: ReadingActivity;
}

const BATAS_TERATAS = 5;

function teratas(hitungan: Map<string, number>, byId: Map<string, Taxonomy>): Tally[] {
  return [...hitungan.entries()]
    .map(([id, count]) => ({ name: byId.get(id)?.name ?? '?', count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, BATAS_TERATAS);
}

const HARI = 24 * 60 * 60 * 1000;

/** Kunci hari lokal, supaya "hari ini" mengikuti jam pengguna bukan UTC. */
function kunciHari(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Merangkum riwayat baca.
 *
 * **Runtun dihitung mundur dari hari ini, dan hari ini boleh kosong.** Membaca
 * pada pukul 23.00 lalu memeriksa statistik pukul 08.00 keesokan harinya tidak
 * boleh menampilkan runtun yang sudah putus — runtunnya baru putus setelah satu
 * hari penuh terlewat tanpa catatan.
 */
export function computeActivity(log: ReadingLogEntry[], now = Date.now()): ReadingActivity {
  const jumlahkan = (sejak: number) => {
    const per = new Map<ProgressUnit, number>();
    for (const entry of log) {
      if (entry.at < sejak) continue;
      per.set(entry.unit, (per.get(entry.unit) ?? 0) + entry.delta);
    }
    return [...per.entries()]
      .map(([unit, total]) => ({ unit, total }))
      .sort((a, b) => b.total - a.total);
  };

  const hariBerisi = new Set(log.map((entry) => kunciHari(entry.at)));

  let streak = 0;
  // Dimulai dari kemarin kalau hari ini masih kosong; lihat catatan di atas.
  let cursor = hariBerisi.has(kunciHari(now)) ? now : now - HARI;
  while (hariBerisi.has(kunciHari(cursor))) {
    streak += 1;
    cursor -= HARI;
  }

  return {
    last7: jumlahkan(now - 7 * HARI),
    last30: jumlahkan(now - 30 * HARI),
    streak,
    activeDays: hariBerisi.size,
    hasHistory: log.length > 0,
  };
}

/**
 * Menghitung ringkasan koleksi.
 *
 * Fungsi murni: menerima data dan mengembalikan angka, tanpa menyentuh database
 * maupun jam sistem sendiri. Waktu dilewatkan sebagai argumen supaya "selesai
 * tahun ini" dan runtun harian bisa diuji tanpa menunggu pergantian hari.
 */
export function computeStats(
  works: Work[],
  taxonomies: Taxonomy[],
  log: ReadingLogEntry[] = [],
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
    activity: computeActivity(log, now),
  };
}
