import { db } from '../db/database';

export interface IntegrityReport {
  /** `primaryImageId` menunjuk gambar yang tidak ada. */
  danglingPrimary: string[];
  /** Baris `images` yang karyanya sudah terhapus. */
  orphanImages: string[];
  /** Baris `imageBlobs` tanpa pasangan di `images`. */
  orphanBlobs: string[];
  /** Pasangan karya→id taksonomi yang sudah tidak ada. */
  danglingTaxonomies: Array<{ workId: string; taxonomyId: string }>;
  /** Perkiraan byte yang bisa dibebaskan. */
  reclaimableBytes: number;
}

export function reportIsClean(report: IntegrityReport): boolean {
  return (
    report.danglingPrimary.length === 0 &&
    report.orphanImages.length === 0 &&
    report.orphanBlobs.length === 0 &&
    report.danglingTaxonomies.length === 0
  );
}

/**
 * Memeriksa rujukan yang menggantung dan data yatim.
 *
 * IndexedDB tidak punya foreign key seperti SQL, jadi tidak ada apa pun yang
 * menjaga penunjuk antar tabel tetap sah. Kalau yang ditunjuk hilang,
 * penunjuknya tetap tinggal dan mengarah ke ruang kosong.
 *
 * Semua masalah jenis ini **diam**: tidak ada yang gagal, tidak ada pesan
 * error, aplikasi tetap berjalan normal. Yang terjadi hanyalah penumpukan
 * perlahan — sampul yang jadi ikon kosong, dan blob gambar yang memakan
 * penyimpanan tanpa pernah ditampilkan.
 *
 * **Fungsi ini hanya membaca.** Tidak ada yang dihapus di sini; pemisahan itu
 * disengaja, supaya laporan bisa ditampilkan dan disetujui lebih dulu.
 */
export async function scanIntegrity(): Promise<IntegrityReport> {
  const [works, images, blobIds, taxonomyIds] = await Promise.all([
    db.works.toArray(),
    db.images.toArray(),
    db.imageBlobs.toCollection().primaryKeys(),
    db.taxonomies.toCollection().primaryKeys(),
  ]);

  const workIds = new Set(works.map((work) => work.id));
  const imageIds = new Set(images.map((image) => image.id));
  const knownTaxonomies = new Set(taxonomyIds as string[]);

  const danglingPrimary = works
    .filter((work) => work.primaryImageId !== null && !imageIds.has(work.primaryImageId))
    .map((work) => work.id);

  const orphanImages = images
    .filter((image) => !workIds.has(image.workId))
    .map((image) => image.id);

  const orphanBlobs = (blobIds as string[]).filter((id) => !imageIds.has(id));

  const danglingTaxonomies: IntegrityReport['danglingTaxonomies'] = [];
  for (const work of works) {
    for (const id of [work.typeId, work.pubStatusId]) {
      if (id !== null && !knownTaxonomies.has(id)) {
        danglingTaxonomies.push({ workId: work.id, taxonomyId: id });
      }
    }
    for (const id of [...work.genreIds, ...work.themeIds]) {
      if (!knownTaxonomies.has(id)) {
        danglingTaxonomies.push({ workId: work.id, taxonomyId: id });
      }
    }
  }

  // Ukuran dihitung hanya untuk blob yang benar-benar akan dibuang. Angka ini
  // yang membuat laporannya berarti bagi pengguna — "12 MB" jauh lebih bisa
  // ditindaklanjuti daripada "3 baris yatim".
  const buangIds = new Set([...orphanBlobs, ...orphanImages]);
  let reclaimableBytes = 0;
  for (const id of buangIds) {
    const blob = await db.imageBlobs.get(id);
    if (blob) reclaimableBytes += blob.blob.size;
  }
  for (const image of images) {
    if (orphanImages.includes(image.id)) reclaimableBytes += image.thumbBlob.size;
  }

  return {
    danglingPrimary,
    orphanImages,
    orphanBlobs,
    danglingTaxonomies,
    reclaimableBytes,
  };
}

/**
 * Merapikan apa yang dilaporkan `scanIntegrity`.
 *
 * **Menerima laporan, bukan memindai ulang.** Ini penting: pengguna menyetujui
 * angka yang dilihatnya, dan yang dihapus harus persis itu. Memindai ulang di
 * dalam sini berarti bisa menghapus sesuatu yang tidak pernah ditampilkan
 * kepadanya.
 *
 * Satu-satunya fungsi di aplikasi ini yang menghapus data tanpa diminta per
 * baris, di aplikasi yang tidak punya cadangan otomatis. Karena itu ia hanya
 * membuang yang **sudah tidak bisa dijangkau siapa pun**: blob tanpa pemilik,
 * gambar tanpa karya, dan penunjuk ke sesuatu yang memang tidak ada. Tidak ada
 * karya, gambar yang masih terpakai, maupun nilai katalog yang disentuh.
 */
export async function repairIntegrity(report: IntegrityReport): Promise<void> {
  await db.transaction('rw', db.works, db.images, db.imageBlobs, async () => {
    if (report.orphanImages.length) {
      await db.imageBlobs.bulkDelete(report.orphanImages);
      await db.images.bulkDelete(report.orphanImages);
    }

    if (report.orphanBlobs.length) {
      await db.imageBlobs.bulkDelete(report.orphanBlobs);
    }

    for (const workId of report.danglingPrimary) {
      await db.works.update(workId, { primaryImageId: null });
    }

    // Dikelompokkan per karya supaya satu karya cukup ditulis sekali walau
    // punya beberapa rujukan menggantung.
    const perWork = new Map<string, Set<string>>();
    for (const { workId, taxonomyId } of report.danglingTaxonomies) {
      const set = perWork.get(workId) ?? new Set<string>();
      set.add(taxonomyId);
      perWork.set(workId, set);
    }

    for (const [workId, buang] of perWork) {
      const work = await db.works.get(workId);
      if (!work) continue;

      await db.works.update(workId, {
        typeId: work.typeId !== null && buang.has(work.typeId) ? null : work.typeId,
        pubStatusId:
          work.pubStatusId !== null && buang.has(work.pubStatusId) ? null : work.pubStatusId,
        genreIds: work.genreIds.filter((id) => !buang.has(id)),
        themeIds: work.themeIds.filter((id) => !buang.has(id)),
      });
    }
  });
}
