import { db } from './database';
import type { ImageRole, WorkImage } from './models';
import { newId } from '../lib/id';

export interface NewImage {
  /** Berkas ukuran penuh. */
  blob: Blob;
  /** Versi ~200px untuk grid dan kartu. */
  thumbBlob: Blob;
  width: number;
  height: number;
  mimeType: string;
  label?: string;
}

/**
 * Hanya metadata dan thumbnail. Berkas penuh sengaja tidak ikut supaya grid
 * galeri tidak pernah menyentuhnya — untuk 35 gambar, itu selisih antara
 * memuat ~400 KB dengan ~2,8 MB.
 */
function listForWork(workId: string, role?: ImageRole): Promise<WorkImage[]> {
  const collection = role
    ? db.images.where('[workId+role]').equals([workId, role])
    : db.images.where('workId').equals(workId);

  return collection.sortBy('sortOrder');
}

/** Baru dipanggil saat penampil layar penuh dibuka. */
async function getFull(imageId: string): Promise<Blob | undefined> {
  const row = await db.imageBlobs.get(imageId);
  return row?.blob;
}

async function add(
  workId: string,
  role: ImageRole,
  image: NewImage,
): Promise<WorkImage> {
  const id = newId();
  const now = Date.now();

  const row: WorkImage = {
    id,
    workId,
    role,
    sortOrder: 0,
    mimeType: image.mimeType,
    width: image.width,
    height: image.height,
    thumbBlob: image.thumbBlob,
    createdAt: now,
  };

  const label = image.label?.trim();
  if (label) row.label = label;

  await db.transaction('rw', db.images, db.imageBlobs, db.works, async () => {
    const existing = await db.images.where('workId').equals(workId).toArray();
    row.sortOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;

    await db.images.add(row);
    await db.imageBlobs.add({ id, blob: image.blob });

    // Sampul pertama otomatis jadi sampul utama, supaya kartu langsung punya
    // gambar tanpa pengguna harus memilih apa pun.
    if (role === 'cover') {
      const work = await db.works.get(workId);
      if (work && !work.primaryImageId) {
        await db.works.update(workId, { primaryImageId: id, updatedAt: now });
      }
    }
  });

  return row;
}

/**
 * Menghapus gambar beserta berkas penuhnya. Kalau gambar itu sedang jadi
 * sampul utama, penunjuknya ikut dikosongkan dalam transaksi yang sama —
 * kalau tidak, kartu akan menunjuk ke baris yang sudah tidak ada.
 */
async function remove(imageId: string): Promise<void> {
  await db.transaction('rw', db.images, db.imageBlobs, db.works, async () => {
    const image = await db.images.get(imageId);
    if (!image) return;

    await db.imageBlobs.delete(imageId);
    await db.images.delete(imageId);

    const work = await db.works.get(image.workId);
    if (work?.primaryImageId !== imageId) return;

    // Mundur bertingkat: sampul tersisa yang urutannya paling awal, lalu gambar
    // apa pun yang tersisa, baru null. Tingkat kedua penting — kalau karya masih
    // punya ilustrasi tapi tidak punya sampul, menampilkan salah satunya di
    // kartu jelas lebih berguna daripada kotak kosong.
    const remaining = await db.images.where('workId').equals(image.workId).sortBy('sortOrder');
    const nextPrimary =
      remaining.find((row) => row.role === 'cover') ?? remaining[0] ?? null;

    await db.works.update(image.workId, {
      primaryImageId: nextPrimary?.id ?? null,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Mengganti isi gambar di tempat — dipakai setelah memotong gambar yang sudah
 * tersimpan. Id, peran, label, dan urutannya dipertahankan, sehingga sampul
 * utama yang menunjuk ke gambar ini tidak perlu ikut diperbarui.
 */
async function replaceContent(
  imageId: string,
  next: Pick<NewImage, 'blob' | 'thumbBlob' | 'width' | 'height' | 'mimeType'>,
): Promise<void> {
  await db.transaction('rw', db.images, db.imageBlobs, async () => {
    await db.images.update(imageId, {
      thumbBlob: next.thumbBlob,
      width: next.width,
      height: next.height,
      mimeType: next.mimeType,
    });

    await db.imageBlobs.put({ id: imageId, blob: next.blob });
  });
}

/** Urutan disimpan sebagai angka, bukan posisi array, supaya stabil. */
async function reorder(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.images, async () => {
    await Promise.all(
      orderedIds.map((id, index) => db.images.update(id, { sortOrder: index })),
    );
  });
}

export const imagesRepo = {
  listForWork,
  getFull,
  add,
  remove,
  reorder,
  replaceContent,

  get(imageId: string): Promise<WorkImage | undefined> {
    return db.images.get(imageId);
  },

  countForWork(workId: string): Promise<number> {
    return db.images.where('workId').equals(workId).count();
  },

  async setLabel(imageId: string, label: string): Promise<void> {
    const trimmed = label.trim();
    await db.images.update(imageId, { label: trimmed || undefined });
  },

  async setRole(imageId: string, role: ImageRole): Promise<void> {
    await db.images.update(imageId, { role });
  },
};
