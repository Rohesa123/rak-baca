import { db } from './database';
import type {
  ReadingStatus,
  Taxonomy,
  Work,
  WorkFilters,
  WorkInput,
  WorkPatch,
  WorkSort,
} from './models';
import { newId } from '../lib/id';

/**
 * Status baca tidak pernah disimpan — selalu diturunkan, supaya mustahil
 * terjadi keadaan janggal seperti "Selesai" sementara progresnya chapter 3.
 *
 * Mengembalikan `null` untuk tipe yang tidak melacak progres (cerpen,
 * artikel): di sana tidak ada label yang pantas ditampilkan sama sekali.
 * Tanpa cabang itu, cerpen akan selamanya tertulis "Belum mulai" karena
 * `progressCurrent`-nya memang tidak pernah beranjak dari nol.
 */
export function readingStatus(
  work: Work,
  type?: Taxonomy | null,
): ReadingStatus | null {
  if (work.finishedAt) return 'selesai';
  if (type && type.tracksProgress === false) return null;
  if (work.progressCurrent === 0) return 'belum';

  if (work.progressTotal !== null && work.progressCurrent >= work.progressTotal) {
    return 'selesai';
  }

  return 'berjalan';
}

function matchesFilters(
  work: Work,
  filters: WorkFilters,
  typeById: Map<string, Taxonomy>,
): boolean {
  // Dicek terhadap `undefined`, bukan falsy: `null` adalah filter yang sah,
  // artinya "hanya yang belum diisi".
  if (filters.typeId !== undefined && work.typeId !== filters.typeId) return false;
  if (filters.pubStatusId !== undefined && work.pubStatusId !== filters.pubStatusId) {
    return false;
  }
  if (filters.ageRating && work.ageRating !== filters.ageRating) return false;
  if (filters.favoritesOnly && !work.favoritedAt) return false;

  if (filters.themeIds?.length) {
    if (!filters.themeIds.every((id) => work.themeIds.includes(id))) return false;
  }

  if (filters.genreIds?.length) {
    if (!filters.genreIds.every((id) => work.genreIds.includes(id))) return false;
  }

  if (filters.excludeThemeIds?.length) {
    if (filters.excludeThemeIds.some((id) => work.themeIds.includes(id))) return false;
  }

  if (filters.excludeGenreIds?.length) {
    if (filters.excludeGenreIds.some((id) => work.genreIds.includes(id))) return false;
  }

  if (filters.readingStatus) {
    const type = work.typeId ? typeById.get(work.typeId) : null;
    if (readingStatus(work, type) !== filters.readingStatus) return false;
  }

  const query = filters.query?.trim().toLowerCase();
  if (query) {
    const haystack = [
      work.title,
      work.altTitle,
      work.author,
      work.synopsis ?? '',
      work.notes ?? '',
    ]
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(query)) return false;
  }

  return true;
}

/** Nilai kosong selalu ditaruh di belakang, apa pun arah urutannya. */
function nullsLast(a: number | null, b: number | null, desc = true): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b - a : a - b;
}

function sortWorks(rows: Work[], sort: WorkSort): Work[] {
  const sorted = [...rows];

  switch (sort) {
    case 'lastRead':
      return sorted.sort((a, b) => nullsLast(a.lastReadAt, b.lastReadAt));
    case 'newest':
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, 'id'));
    case 'rating':
      return sorted.sort((a, b) => nullsLast(a.personalRating, b.personalRating));
    case 'progress':
      // Yang paling jauh dibaca lebih dulu. Sengaja memakai angka mentah,
      // bukan persentase: karya ongoing tidak punya total yang bisa dipakai
      // sebagai pembagi.
      return sorted.sort((a, b) => b.progressCurrent - a.progressCurrent);
  }
}

/**
 * Penyaringan dilakukan di memori. Tabel `works` hanya berisi metadata — blob
 * gambar ada di tabel terpisah — jadi satu koleksi pribadi berukuran ratusan
 * judul hanya beberapa ratus KB. Menyusun query indeks berlapis untuk kombinasi
 * pencarian teks, banyak tema, banyak genre, dan status turunan jauh lebih
 * rumit tanpa keuntungan nyata di skala ini.
 *
 * Tinjau ulang kalau koleksi menembus sekitar 5.000 judul. Yang pertama
 * dilakukan saat itu bukan mengganti cara pencariannya, melainkan menyimpan
 * satu field `searchText` gabungan yang dihitung sekali saat menyimpan.
 */
async function list(filters: WorkFilters = {}): Promise<Work[]> {
  const needsTypes = filters.readingStatus !== undefined;

  const [rows, types] = await Promise.all([
    db.works.toArray(),
    needsTypes ? db.taxonomies.where('kind').equals('type').toArray() : [],
  ]);

  const typeById = new Map(types.map((type) => [type.id, type]));
  const filtered = rows.filter((work) => matchesFilters(work, filters, typeById));

  return sortWorks(filtered, filters.sort ?? 'lastRead');
}

async function create(input: WorkInput): Promise<Work> {
  const now = Date.now();
  const title = input.title.trim();

  // Satuan progres mengikuti tipe kalau pemanggil tidak menentukannya.
  let progressUnit = input.progressUnit;
  if (!progressUnit && input.typeId) {
    const type = await db.taxonomies.get(input.typeId);
    progressUnit = type?.defaultProgressUnit;
  }

  const work: Work = {
    id: newId(),
    title,
    // Judul alternatif default mengikuti judul asli, bukan dikosongkan —
    // supaya kartu selalu punya sesuatu untuk ditampilkan.
    altTitle: input.altTitle?.trim() || title,
    author: input.author?.trim() ?? '',
    typeId: input.typeId ?? null,
    themeIds: input.themeIds ?? [],
    genreIds: input.genreIds ?? [],
    pubStatusId: input.pubStatusId ?? null,
    ageRating: input.ageRating ?? null,
    progressUnit: progressUnit ?? 'chapter',
    progressCurrent: input.progressCurrent ?? 0,
    progressTotal: input.progressTotal ?? null,
    lastReadAt: null,
    personalRating: input.personalRating ?? null,
    favoritedAt: null,
    finishedAt: null,
    primaryImageId: null,
    createdAt: now,
    updatedAt: now,
  };

  // Teks kosong tidak disimpan sebagai string kosong.
  const synopsis = input.synopsis?.trim();
  if (synopsis) work.synopsis = synopsis;
  const notes = input.notes?.trim();
  if (notes) work.notes = notes;
  const sourceUrl = input.sourceUrl?.trim();
  if (sourceUrl) work.sourceUrl = sourceUrl;

  await db.works.add(work);
  return work;
}

/**
 * Field yang di-set `undefined` di dalam patch dihapus dari record, bukan
 * disimpan sebagai undefined. Ini yang membuat catatan atau tautan yang
 * dikosongkan benar-benar hilang.
 */
async function update(id: string, patch: WorkPatch): Promise<void> {
  await db.works
    .where(':id')
    .equals(id)
    .modify((work) => {
      const target = work as unknown as Record<string, unknown>;

      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete target[key];
        else target[key] = value;
      }

      work.updatedAt = Date.now();
    });
}

/** Gambar dan berkas penuhnya ikut terhapus, dalam satu transaksi. */
async function remove(id: string): Promise<void> {
  await db.transaction('rw', db.works, db.images, db.imageBlobs, async () => {
    const imageIds = await db.images.where('workId').equals(id).primaryKeys();

    await db.imageBlobs.bulkDelete(imageIds);
    await db.images.where('workId').equals(id).delete();
    await db.works.delete(id);
  });
}

/**
 * Menjepit progres ke rentang yang masuk akal.
 *
 * Batas atasnya `max(total, sebelumnya)`, bukan `total` begitu saja. Bedanya
 * penting untuk satu kasus: pengguna yang menurunkan total di form sampai di
 * bawah progres yang sudah tercatat. Menjepit lurus ke total akan diam-diam
 * memangkas angka yang sudah dibaca; dengan rumus ini, nilai yang sudah
 * terlanjur lewat dibiarkan apa adanya — tetap bisa diturunkan manual, tapi
 * tidak pernah ditarik turun tanpa diminta.
 */
/**
 * Progres sudah mentok di totalnya. Dipakai UI untuk menonaktifkan tombol
 * tambah — menjepit di repo saja membuat tombolnya tetap bisa ditekan tanpa
 * efek apa pun, dan itu terasa seperti aplikasi yang rusak.
 */
export function isProgressAtEnd(work: Work): boolean {
  return work.progressTotal !== null && work.progressCurrent >= work.progressTotal;
}

function clampProgress(next: number, total: number | null, previous: number): number {
  const floored = Math.max(0, next);
  if (total === null) return floored;
  return Math.min(floored, Math.max(total, previous));
}

/**
 * Menaikkan progres. Inilah aksi yang paling sering dipakai, jadi harus bisa
 * dipanggil langsung dari kartu tanpa membuka form — kalau harus lewat form,
 * pencatatan progres akan berhenti dilakukan setelah minggu pertama.
 */
async function bumpProgress(id: string, delta = 1): Promise<void> {
  const now = Date.now();

  await db.works
    .where(':id')
    .equals(id)
    .modify((work) => {
      work.progressCurrent = clampProgress(
        work.progressCurrent + delta,
        work.progressTotal,
        work.progressCurrent,
      );
      work.lastReadAt = now;
      work.updatedAt = now;

      // Mencapai total menandai selesai dengan sendirinya.
      if (
        work.progressTotal !== null &&
        work.progressCurrent >= work.progressTotal &&
        !work.finishedAt
      ) {
        work.finishedAt = now;
      }
    });
}

async function setProgress(id: string, current: number): Promise<void> {
  const now = Date.now();

  await db.works
    .where(':id')
    .equals(id)
    .modify((work) => {
      work.progressCurrent = clampProgress(current, work.progressTotal, work.progressCurrent);
      work.lastReadAt = now;
      work.updatedAt = now;
    });
}

export const worksRepo = {
  list,
  create,
  update,
  remove,
  bumpProgress,
  setProgress,

  get(id: string): Promise<Work | undefined> {
    return db.works.get(id);
  },

  count(): Promise<number> {
    return db.works.count();
  },

  /** Favorit disimpan sebagai timestamp; lihat catatan di `models.ts`. */
  async toggleFavorite(id: string): Promise<void> {
    await db.works
      .where(':id')
      .equals(id)
      .modify((work) => {
        work.favoritedAt = work.favoritedAt ? null : Date.now();
        work.updatedAt = Date.now();
      });
  },

  /**
   * Untuk karya yang totalnya tidak diketahui — ongoing, atau memang tidak
   * bernomor. Tanpa tombol ini, karya semacam itu tidak akan pernah bisa
   * terhitung selesai lewat perbandingan angka.
   */
  async setFinished(id: string, finished: boolean): Promise<void> {
    await db.works.update(id, {
      finishedAt: finished ? Date.now() : null,
      updatedAt: Date.now(),
    });
  },

  async setRating(id: string, rating: number | null): Promise<void> {
    await db.works.update(id, { personalRating: rating, updatedAt: Date.now() });
  },

  async setPrimaryImage(id: string, imageId: string | null): Promise<void> {
    await db.works.update(id, { primaryImageId: imageId, updatedAt: Date.now() });
  },
};
