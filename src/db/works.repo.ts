import { db } from './database';
import type {
  ProgressUnit,
  ReadingStatus,
  SearchField,
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
    // Judul alternatif ikut ke dalam cakupan "judul", bukan berdiri sendiri —
    // keduanya menamai karya yang sama, dan pengguna yang mencari judul tidak
    // peduli nama mana yang tercatat di medan mana.
    const fields: Record<SearchField, string[]> = {
      all: [work.title, work.altTitle, work.author, work.synopsis ?? '', work.notes ?? ''],
      title: [work.title, work.altTitle],
      author: [work.author],
    };

    const haystack = fields[filters.searchField ?? 'all'].join(' ').toLowerCase();
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
    case 'manual':
      return sorted.sort(compareManual);
  }
}

/**
 * Urutan manual, dengan `undefined` yang punya arti.
 *
 * Karya yang belum pernah diurutkan manual **tidak dianggap rusak** — ia hanya
 * belum punya tempat, jadi jatuh ke belakang mengikuti urutan bawaan. Ini yang
 * membuat pemasangan lama langsung bekerja benar tanpa perbaikan data apa pun,
 * dan karya yang baru ditambah muncul di bawah alih-alih menyelinap ke tengah.
 */
function compareManual(a: Work, b: Work): number {
  const pa = a.sortOrder;
  const pb = b.sortOrder;

  if (pa !== undefined && pb !== undefined) return pa - pb;
  if (pa !== undefined) return -1;
  if (pb !== undefined) return 1;

  // Sama-sama belum berposisi: pakai urutan bawaan supaya hasilnya stabil,
  // bukan bergantung pada urutan baca dari database.
  return b.createdAt - a.createdAt;
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

/**
 * Karya lain yang judulnya sama persis, untuk memperingatkan saat mencatat.
 *
 * **Peringatan, bukan larangan.** Judul yang sama sering kali sah: satu karya
 * bisa punya versi manga dan versi novel, dan keduanya berhak dicatat terpisah.
 * Karena itu fungsi ini hanya melapor — tidak ada yang diblokir, tidak ada yang
 * digabung otomatis.
 *
 * Pencocokannya sama persis setelah dinormalkan, bukan "mengandung". Pencocokan
 * parsial akan memperingatkan setiap kali ada kata yang kebetulan sama, dan
 * peringatan yang terlalu sering muncul berhenti dibaca.
 *
 * `altTitle` ikut diperiksa di kedua sisi, karena satu karya kerap dikenal
 * dengan lebih dari satu nama dan orang tidak selalu mengetik nama yang sama.
 */
async function findSimilarTitles(title: string, excludeId?: string): Promise<Work[]> {
  const needle = title.trim().toLowerCase();
  if (!needle) return [];

  const rows = await db.works.toArray();

  return rows.filter((work) => {
    if (work.id === excludeId) return false;
    return (
      work.title.trim().toLowerCase() === needle ||
      work.altTitle.trim().toLowerCase() === needle
    );
  });
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
  await db.transaction('rw', db.works, db.images, db.imageBlobs, db.readingLog, async () => {
    const imageIds = await db.images.where('workId').equals(id).primaryKeys();

    await db.imageBlobs.bulkDelete(imageIds);
    await db.images.where('workId').equals(id).delete();
    // Riwayat ikut terhapus: entri yang menunjuk karya yang tidak ada lagi
    // adalah persis jenis data menggantung yang §37 dibuat untuk membersihkan.
    await db.readingLog.where('workId').equals(id).delete();
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
/**
 * Mencatat satu peristiwa membaca.
 *
 * **Hanya saat progres bertambah.** Menurunkan angka adalah koreksi salah
 * ketik, bukan kegiatan membaca — mencatatnya akan membuat "chapter bulan ini"
 * ikut menghitung perbaikan kesalahan.
 *
 * Selisihnya dihitung dari nilai **sesudah dijepit**, bukan dari yang diminta.
 * Menekan +1 pada karya yang sudah menyentuh totalnya tidak mengubah apa pun,
 * dan karenanya juga tidak boleh tercatat sebagai membaca.
 *
 * Dipanggil dari satu tempat oleh kedua jalur progres, supaya keduanya tidak
 * bisa berbeda perilaku tanpa ada yang menyadarinya.
 */
async function logReading(
  workId: string,
  sebelum: number,
  sesudah: number,
  unit: ProgressUnit,
  at: number,
): Promise<void> {
  const delta = sesudah - sebelum;
  if (delta <= 0) return;

  await db.readingLog.add({ id: newId(), workId, at, delta, unit });
}

async function bumpProgress(id: string, delta = 1): Promise<void> {
  const now = Date.now();
  const sebelum = await db.works.get(id);

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

  const sesudah = await db.works.get(id);
  if (sebelum && sesudah) {
    await logReading(id, sebelum.progressCurrent, sesudah.progressCurrent, sesudah.progressUnit, now);
  }
}

export interface BulkClassifyPatch {
  /** `undefined` berarti jangan diubah. `null` berarti kosongkan. */
  typeId?: string | null;
  pubStatusId?: string | null;
  /** Ditambahkan ke yang sudah ada, tidak pernah menggantikannya. */
  addGenreIds?: string[];
  addThemeIds?: string[];
}

/**
 * Mengubah klasifikasi banyak karya sekaligus.
 *
 * **Genre dan tema hanya bisa ditambahkan, tidak pernah diganti.** Mengganti
 * akan menghapus klasifikasi yang susah payah dibuat, dan pada dua puluh karya
 * sekaligus itu tidak akan disadari sampai terlambat. Kalaupun suatu saat
 * "ganti" dibutuhkan, ia harus jadi tindakan terpisah yang bunyinya berbeda.
 *
 * Tipe dan status terbit memang menimpa — keduanya bernilai tunggal, jadi tidak
 * ada semantik "tambah" yang masuk akal. Karena itu pemanggil wajib
 * mengonfirmasi lebih dulu dan menyebut berapa karya yang terkena.
 *
 * **`progressUnit` sengaja tidak ikut berubah** saat tipe diganti, berbeda dari
 * form satuan. Di form, pengguna sedang memilih satu karya dan melihat
 * akibatnya; di sini mengubah satuan dua puluh karya sekaligus akan mengubah
 * cara progres mereka terbaca — "Ch. 45" jadi "Hal. 45" — tanpa diminta.
 */
async function bulkClassify(ids: string[], patch: BulkClassifyPatch): Promise<number> {
  if (ids.length === 0) return 0;

  const now = Date.now();
  let changed = 0;

  await db.transaction('rw', db.works, async () => {
    for (const id of ids) {
      await db.works
        .where(':id')
        .equals(id)
        .modify((work) => {
          let touched = false;

          if (patch.typeId !== undefined && work.typeId !== patch.typeId) {
            work.typeId = patch.typeId;
            touched = true;
          }

          if (patch.pubStatusId !== undefined && work.pubStatusId !== patch.pubStatusId) {
            work.pubStatusId = patch.pubStatusId;
            touched = true;
          }

          const gabung = (kini: string[], tambahan?: string[]) => {
            if (!tambahan?.length) return kini;
            const baru = tambahan.filter((value) => !kini.includes(value));
            if (baru.length === 0) return kini;
            touched = true;
            return [...kini, ...baru];
          };

          work.genreIds = gabung(work.genreIds, patch.addGenreIds);
          work.themeIds = gabung(work.themeIds, patch.addThemeIds);

          // `updatedAt` hanya disentuh kalau ada yang benar-benar berubah;
          // karya yang sudah bernilai sama tidak perlu dicatat sebagai diubah.
          if (touched) {
            work.updatedAt = now;
            changed += 1;
          }
        });
    }
  });

  return changed;
}

/**
 * Menggeser satu karya satu langkah pada urutan manual.
 *
 * Tombol naik/turun, bukan seret-dan-lepas. Mengikuti keputusan yang sama pada
 * galeri gambar — jauh lebih andal disentuh — dan menghindari kombinasi paling
 * rawan di aplikasi ini sekarang: seret-dan-lepas di atas daftar yang
 * tervirtualisasi, tempat baris tujuan bisa saja belum dirender.
 *
 * Menulis **hanya baris yang posisinya benar-benar berubah**. Pada pemanggilan
 * pertama itu berarti seluruh daftar, karena belum ada yang punya `sortOrder`;
 * sesudahnya cukup dua baris.
 *
 * `filters` diteruskan supaya penggeseran mengikuti apa yang sedang dilihat
 * pengguna. Tanpa itu, menggeser sesuatu di daftar terfilter akan meloncatinya
 * melewati karya-karya yang sedang tersembunyi.
 */
async function moveInManualOrder(
  id: string,
  direction: -1 | 1,
  filters: WorkFilters = {},
): Promise<boolean> {
  // Dua daftar, dan keduanya diperlukan.
  //
  // Yang **terlihat** menentukan ke mana karya itu pindah: satu langkah berarti
  // bertukar tempat dengan tetangga yang benar-benar terlihat, bukan dengan
  // karya yang sedang tersembunyi filter.
  //
  // Yang **global** menentukan angka yang ditulis. Menomori ulang dari daftar
  // terfilter adalah kesalahan yang halus tapi merusak: posisinya bertabrakan
  // dengan karya di luar filter, dan karya yang tidak pernah disentuh ikut
  // teracak — baru ketahuan setelah filternya dilepas.
  const [semua, terlihat] = await Promise.all([
    list({ sort: 'manual' }),
    list({ ...filters, sort: 'manual' }),
  ]);

  const posisiTerlihat = terlihat.findIndex((work) => work.id === id);
  const tetangga = terlihat[posisiTerlihat + direction];
  if (posisiTerlihat === -1 || !tetangga) return false;

  const from = semua.findIndex((work) => work.id === id);
  if (from === -1) return false;

  const [moved] = semua.splice(from, 1);

  // Dicari ulang setelah splice: indeks tetangga bergeser kalau ia berada
  // setelah posisi asal.
  const anchor = semua.findIndex((work) => work.id === tetangga.id);
  if (anchor === -1) return false;

  semua.splice(direction === -1 ? anchor : anchor + 1, 0, moved);

  const now = Date.now();

  await db.transaction('rw', db.works, async () => {
    for (const [index, work] of semua.entries()) {
      if (work.sortOrder === index) continue;
      await db.works.update(work.id, { sortOrder: index, updatedAt: now });
    }
  });

  return true;
}

/**
 * Melempar satu karya ke ujung urutan manual.
 *
 * Dengan panah saja, memindahkan karya dari posisi seratus ke posisi satu butuh
 * sembilan puluh sembilan ketukan — yang berarti urutan manual hanya berguna
 * untuk penataan kecil, bukan untuk menyusun ulang sungguhan.
 *
 * Memakai ujung daftar **yang terlihat**, bukan ujung koleksi. Di daftar
 * terfilter, "paling atas" berarti di atas karya terlihat pertama, bukan
 * meloncat ke puncak koleksi yang sedang tersembunyi.
 */
async function moveToEdgeOfManualOrder(
  id: string,
  edge: 'top' | 'bottom',
  filters: WorkFilters = {},
): Promise<boolean> {
  const [semua, terlihat] = await Promise.all([
    list({ sort: 'manual' }),
    list({ ...filters, sort: 'manual' }),
  ]);

  const patokan = edge === 'top' ? terlihat[0] : terlihat[terlihat.length - 1];
  if (!patokan || patokan.id === id) return false;
  if (!terlihat.some((work) => work.id === id)) return false;

  const from = semua.findIndex((work) => work.id === id);
  if (from === -1) return false;

  const [moved] = semua.splice(from, 1);
  const anchor = semua.findIndex((work) => work.id === patokan.id);
  if (anchor === -1) return false;

  semua.splice(edge === 'top' ? anchor : anchor + 1, 0, moved);

  const now = Date.now();

  await db.transaction('rw', db.works, async () => {
    for (const [index, work] of semua.entries()) {
      if (work.sortOrder === index) continue;
      await db.works.update(work.id, { sortOrder: index, updatedAt: now });
    }
  });

  return true;
}

async function setProgress(id: string, current: number): Promise<void> {
  const now = Date.now();
  const sebelum = await db.works.get(id);

  await db.works
    .where(':id')
    .equals(id)
    .modify((work) => {
      work.progressCurrent = clampProgress(current, work.progressTotal, work.progressCurrent);
      work.lastReadAt = now;
      work.updatedAt = now;
    });

  const sesudah = await db.works.get(id);
  if (sebelum && sesudah) {
    await logReading(id, sebelum.progressCurrent, sesudah.progressCurrent, sesudah.progressUnit, now);
  }
}

export const worksRepo = {
  list,
  findSimilarTitles,
  bulkClassify,
  moveInManualOrder,
  moveToEdgeOfManualOrder,
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

  /**
   * Karya yang paling pantas dilanjutkan, terbaru lebih dulu.
   *
   * Tujuan aplikasi ini satu kalimat: *apa yang saya baca, sampai mana*.
   * Jawabannya selama ini tersebar di daftar biasa yang kebetulan terurut
   * `lastReadAt`, dan hilang begitu pengguna mengganti pengurutan atau
   * memfilter. Daftar ini menjawabnya tanpa bergantung pada keduanya.
   *
   * Tiga hal disingkirkan, semuanya karena "lanjutkan" tidak berarti apa-apa
   * di sana: karya yang sudah ditandai selesai, karya yang progresnya sudah
   * menyentuh total, dan tipe yang memang tidak melacak progres seperti cerpen
   * dan artikel.
   *
   * Karya yang belum pernah dibaca ikut tersaring dengan sendirinya:
   * `lastReadAt`-nya `null`, dan IndexedDB tidak memasukkan nilai null ke
   * dalam indeks — jadi `orderBy` sudah melewatkannya tanpa perlu diperiksa.
   */
  async continueReading(limit = 3): Promise<Work[]> {
    const types = await db.taxonomies.where('kind').equals('type').toArray();
    const tanpaProgres = new Set(
      types.filter((type) => type.tracksProgress === false).map((type) => type.id),
    );

    // `limit` setelah `filter` menghentikan iterasi lebih awal, jadi koleksi
    // besar tidak perlu dimuat seluruhnya hanya untuk mengambil tiga teratas.
    return db.works
      .orderBy('lastReadAt')
      .reverse()
      .filter(
        (work) =>
          work.finishedAt === null &&
          !isProgressAtEnd(work) &&
          !(work.typeId !== null && tanpaProgres.has(work.typeId)),
      )
      .limit(limit)
      .toArray();
  },

  /**
   * `createdAt` karya tertua, atau `null` kalau koleksinya kosong.
   *
   * Dipakai pengingat cadangan sebagai patokan saat pengguna belum pernah
   * mengekspor sama sekali — menjawab "sudah berapa lama data ini ada tanpa
   * salinan". Memakai indeks `createdAt`, jadi tidak memindai seluruh tabel.
   */
  async oldestCreatedAt(): Promise<number | null> {
    const oldest = await db.works.orderBy('createdAt').first();
    return oldest?.createdAt ?? null;
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
