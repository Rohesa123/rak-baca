import { zip, unzip, strToU8, strFromU8 } from 'fflate';
import type { Unzipped, Zippable } from 'fflate';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db } from '../db/database';
import type { Taxonomy, Work, WorkImage } from '../db/models';
import { makeThumbnail } from './image';
import { isNative } from './platform';
import { newId } from './id';

export const BACKUP_FORMAT = 'rak-baca-export';
export const BACKUP_FORMAT_VERSION = 1;
/** Versi schema Dexie saat berkas dibuat; dipakai impor untuk memutuskan migrasi. */
export const BACKUP_SCHEMA_VERSION = 1;

/** Metadata gambar di dalam berkas ekspor. Thumbnail sengaja tidak ikut. */
type ExportedImage = Omit<WorkImage, 'thumbBlob'> & { file?: string };

interface BackupDocument {
  format: string;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  scope: 'all' | 'selection';
  includesImages: boolean;
  taxonomies: Taxonomy[];
  works: Work[];
  images: ExportedImage[];
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('png')) return 'png';
  return 'jpg';
}

function zipAsync(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, {}, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

function unzipAsync(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, (error, result) => (error ? reject(error) : resolve(result)));
  });
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

// ---------------------------------------------------------------- ekspor

export interface ExportOptions {
  includeImages: boolean;
  /** Kosong berarti seluruh koleksi. */
  workIds?: string[];
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  workCount: number;
  imageCount: number;
}

export async function buildExport(options: ExportOptions): Promise<ExportResult> {
  const [allWorks, allTaxonomies] = await Promise.all([
    db.works.toArray(),
    db.taxonomies.toArray(),
  ]);

  const selected = options.workIds?.length
    ? allWorks.filter((work) => options.workIds!.includes(work.id))
    : allWorks;

  const scope: BackupDocument['scope'] = options.workIds?.length ? 'selection' : 'all';

  // Untuk cakupan pilihan, hanya taksonomi yang benar-benar dirujuk yang ikut.
  // Kalau tidak, berkasnya membawa genre dan tema yatim yang lalu ikut terbuat
  // di perangkat tujuan.
  let taxonomies = allTaxonomies;
  if (scope === 'selection') {
    const used = new Set<string>();
    for (const work of selected) {
      if (work.typeId) used.add(work.typeId);
      if (work.pubStatusId) used.add(work.pubStatusId);
      work.themeIds.forEach((id) => used.add(id));
      work.genreIds.forEach((id) => used.add(id));
    }
    taxonomies = allTaxonomies.filter((row) => used.has(row.id));
  }

  const workIds = new Set(selected.map((work) => work.id));
  const images = (await db.images.toArray()).filter((image) => workIds.has(image.workId));

  const files: Zippable = {};
  const exportedImages: ExportedImage[] = [];

  for (const image of images) {
    const { thumbBlob: _thumb, ...meta } = image;
    const entry: ExportedImage = { ...meta };

    if (options.includeImages) {
      const full = await db.imageBlobs.get(image.id);
      if (full) {
        const path = `images/${image.id}.${extensionFor(image.mimeType)}`;
        // level 0 = simpan apa adanya. JPEG dan WebP sudah terkompresi;
        // men-deflate ulang membakar CPU untuk penghematan mendekati nol.
        files[path] = [await blobToBytes(full.blob), { level: 0 }];
        entry.file = path;
      }
    }

    exportedImages.push(entry);
  }

  const document: BackupDocument = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
    includesImages: options.includeImages,
    taxonomies,
    works: selected,
    images: exportedImages,
  };

  files['data.json'] = [strToU8(JSON.stringify(document, null, 2)), { level: 6 }];

  const bytes = await zipAsync(files);
  const stamp = new Date().toISOString().slice(0, 10);
  const suffix = options.includeImages ? '' : '-tanpa-gambar';

  return {
    blob: new Blob([bytes as BlobPart], { type: 'application/zip' }),
    filename: `rak-baca-${stamp}${suffix}.zip`,
    workCount: selected.length,
    imageCount: options.includeImages ? exportedImages.filter((i) => i.file).length : 0,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Gagal membaca berkas'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Di Android, menulis langsung ke folder Documents merepotkan karena aturan
 * scoped storage. Yang andal: tulis ke direktori cache aplikasi lalu serahkan
 * ke lembar berbagi, sehingga pengguna sendiri yang memilih tujuannya.
 */
export async function deliverExport(result: ExportResult): Promise<'unduh' | 'bagikan'> {
  if (!isNative()) {
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return 'unduh';
  }

  const written = await Filesystem.writeFile({
    path: result.filename,
    data: await blobToBase64(result.blob),
    directory: Directory.Cache,
  });

  await Share.share({
    title: 'Cadangan Rak Baca',
    url: written.uri,
  });

  return 'bagikan';
}

// ----------------------------------------------------------------- impor

export interface ImportSummary {
  worksAdded: number;
  worksSkipped: number;
  taxonomiesAdded: number;
  imagesAdded: number;
}

export class BackupFormatError extends Error {
  // `name` di-set eksplisit supaya pemanggil bisa mengenalinya tanpa mengimpor
  // kelas ini — penting karena modul backup dimuat secara dinamis.
  override name = 'BackupFormatError';
}

function parseDocument(raw: string): BackupDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupFormatError('Berkas data.json rusak atau bukan JSON.');
  }

  const document = parsed as Partial<BackupDocument>;

  if (document.format !== BACKUP_FORMAT) {
    throw new BackupFormatError('Berkas ini bukan cadangan Rak Baca.');
  }

  if ((document.formatVersion ?? 0) > BACKUP_FORMAT_VERSION) {
    throw new BackupFormatError(
      'Cadangan ini dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasinya dulu.',
    );
  }

  if (!Array.isArray(document.works) || !Array.isArray(document.taxonomies)) {
    throw new BackupFormatError('Isi cadangan tidak lengkap.');
  }

  return document as BackupDocument;
}

/**
 * Impor selalu bersifat **menggabung**, tidak pernah menimpa. Ini menghilangkan
 * seluruh kelas kecelakaan di mana pengguna menimpa koleksinya sendiri dengan
 * cadangan lama.
 *
 * Aturannya:
 *  - karya dengan id yang sudah ada dilewati, bukan ditimpa, sehingga impor
 *    bersifat idempoten dan cadangan lama tidak membatalkan perubahan baru
 *  - taksonomi dicocokkan berdasarkan pasangan kind+name; yang sudah ada
 *    dipakai ulang dan rujukan di karya dipetakan ulang ke id lokal. Tanpa
 *    pemetaan ini, impor langsung melempar ConstraintError karena
 *    `&[kind+name]` adalah unique index
 */
export async function importBackup(file: Blob): Promise<ImportSummary> {
  let archive: Unzipped;

  try {
    archive = await unzipAsync(await blobToBytes(file));
  } catch {
    // fflate melempar "invalid zip data" yang tidak berarti apa-apa bagi
    // pengguna; diterjemahkan jadi pesan yang bisa ditindaklanjuti.
    throw new BackupFormatError('Berkas ini bukan zip yang bisa dibaca.');
  }

  const rawDocument = archive['data.json'];
  if (!rawDocument) throw new BackupFormatError('Berkas zip tidak memuat data.json.');

  const document = parseDocument(strFromU8(rawDocument));

  // Seluruh pekerjaan berat — dekode gambar dan pembuatan thumbnail — selesai
  // di luar transaksi. Transaksi Dexie tidak boleh menunggu promise non-Dexie.
  const existingTaxonomies = await db.taxonomies.toArray();
  const localByKey = new Map(
    existingTaxonomies.map((row) => [`${row.kind} ${row.name}`, row]),
  );

  const idMap = new Map<string, string>();
  const taxonomiesToAdd: Taxonomy[] = [];

  for (const incoming of document.taxonomies) {
    const key = `${incoming.kind} ${incoming.name}`;
    const local = localByKey.get(key);

    if (local) {
      idMap.set(incoming.id, local.id);
      continue;
    }

    const fresh: Taxonomy = { ...incoming, id: newId() };
    localByKey.set(key, fresh);
    taxonomiesToAdd.push(fresh);
    idMap.set(incoming.id, fresh.id);
  }

  const remap = (id: string | null): string | null => (id ? (idMap.get(id) ?? null) : null);

  const existingWorkIds = new Set(await db.works.toCollection().primaryKeys());
  const worksToAdd: Work[] = [];
  let worksSkipped = 0;

  for (const work of document.works) {
    if (existingWorkIds.has(work.id)) {
      worksSkipped += 1;
      continue;
    }

    worksToAdd.push({
      ...work,
      typeId: remap(work.typeId),
      pubStatusId: remap(work.pubStatusId),
      themeIds: work.themeIds.map((id) => idMap.get(id)).filter((id): id is string => !!id),
      genreIds: work.genreIds.map((id) => idMap.get(id)).filter((id): id is string => !!id),
    });
  }

  const addedWorkIds = new Set(worksToAdd.map((work) => work.id));
  const imagesToAdd: WorkImage[] = [];
  const blobsToAdd: Array<{ id: string; blob: Blob }> = [];

  for (const image of document.images) {
    if (!addedWorkIds.has(image.workId) || !image.file) continue;

    const bytes = archive[image.file];
    if (!bytes) continue;

    const blob = new Blob([bytes as BlobPart], { type: image.mimeType });

    // Thumbnail dibuat ulang di sini, bukan diambil dari zip — ia sepenuhnya
    // turunan, dan memasukkannya ke ekspor hanya menggelembungkan berkas.
    imagesToAdd.push({ ...image, thumbBlob: await makeThumbnail(blob) });
    blobsToAdd.push({ id: image.id, blob });
  }

  // Satu transaksi untuk seluruh penulisan: berkas rusak di tengah jalan tidak
  // boleh meninggalkan koleksi setengah jadi.
  await db.transaction('rw', db.works, db.taxonomies, db.images, db.imageBlobs, async () => {
    if (taxonomiesToAdd.length) await db.taxonomies.bulkAdd(taxonomiesToAdd);
    if (worksToAdd.length) await db.works.bulkAdd(worksToAdd);
    if (imagesToAdd.length) await db.images.bulkPut(imagesToAdd);
    if (blobsToAdd.length) await db.imageBlobs.bulkPut(blobsToAdd);
  });

  return {
    worksAdded: worksToAdd.length,
    worksSkipped,
    taxonomiesAdded: taxonomiesToAdd.length,
    imagesAdded: imagesToAdd.length,
  };
}
