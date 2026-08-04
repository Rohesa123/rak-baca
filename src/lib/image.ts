import { Camera, MediaTypeSelection } from '@capacitor/camera';

export type ImagePurpose = 'cover' | 'art';

export type QualityPreset = 'tinggi' | 'sedang' | 'hemat';

interface QualityProfile {
  /** Sisi terpanjang berkas penuh, per peruntukan. */
  cover: number;
  art: number;
  quality: number;
}

/**
 * Foto kamera HP berukuran 4–8 MB; tanpa pengecilan, IndexedDB cepat membengkak
 * dan berisiko kena quota eviction. Art dapat jatah lebih besar daripada sampul
 * karena ilustrasi memang layak dilihat lebih besar.
 */
export const QUALITY_PRESETS: Record<QualityPreset, QualityProfile> = {
  tinggi: { cover: 1200, art: 1600, quality: 0.85 },
  sedang: { cover: 800, art: 1200, quality: 0.8 },
  hemat: { cover: 640, art: 900, quality: 0.7 },
};

export const DEFAULT_QUALITY_PRESET: QualityPreset = 'sedang';

/**
 * Thumbnail wajib, bukan optimasi. Grid galeri memuat puluhan gambar sekaligus;
 * memakai berkas penuh berarti mendekode megabyte gambar hanya untuk
 * ditampilkan sebesar 100 piksel.
 */
const THUMB_DIMENSION = 200;
const THUMB_QUALITY = 0.7;

/** Persegi panjang dalam koordinat piksel gambar sumber. */
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessedImage {
  /** Berkas penuh, untuk penampil layar penuh. */
  blob: Blob;
  /** ~200px, untuk kartu dan grid. */
  thumbBlob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * WebP menghasilkan berkas 25–30% lebih kecil daripada JPEG pada kualitas
 * setara. Didukung penuh di WebView minSdk 26, tapi tetap dicek sekali —
 * `toBlob` mengembalikan null untuk tipe yang tidak didukung, dan WebView usang
 * yang belum diperbarui lewat Play Store masih mungkin ada.
 */
let cachedFormat: string | null = null;

async function preferredFormat(): Promise<string> {
  if (cachedFormat) return cachedFormat;

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  const probe = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.8);
  });

  cachedFormat = probe?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  return cachedFormat;
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(error.message);
}

async function fetchAndRevoke(webPath: string): Promise<Blob> {
  try {
    const response = await fetch(webPath);
    return await response.blob();
  } finally {
    // Implementasi web plugin membuat object URL dan tidak pernah mencabutnya.
    // Di native, webPath berskema capacitor:// sehingga langkah ini dilewati.
    if (webPath.startsWith('blob:')) URL.revokeObjectURL(webPath);
  }
}

/**
 * `chooseFromGallery`, bukan `getPhoto`. Yang terakhir sudah ditandai
 * deprecated di @capacitor/camera 8 dan akan dihapus di versi mayor berikutnya.
 * API baru ini juga langsung mendukung pemilihan banyak berkas, dan
 * implementasi web-nya memakai file input biasa sehingga tetap bisa diuji di
 * peramban.
 *
 * Mengembalikan array kosong kalau pengguna membatalkan — pembatalan bukan
 * kegagalan, jadi tidak dilempar sebagai error.
 */
export async function chooseImagesFromGallery(limit = 0): Promise<Blob[]> {
  let webPaths: string[];

  try {
    const picked = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: limit !== 1,
      limit,
      // Menyerahkan koreksi EXIF ke lapisan native juga; `processImage` tetap
      // memakai `imageOrientation: 'from-image'` sebagai jaring pengaman di web.
      correctOrientation: true,
      editable: 'no',
      quality: 90,
    });

    webPaths = picked.results
      .map((result) => result.webPath)
      .filter((path): path is string => Boolean(path));
  } catch (error) {
    if (isCancellation(error)) return [];
    throw error;
  }

  return Promise.all(webPaths.map(fetchAndRevoke));
}

/** Pembungkus satu gambar. `null` kalau dibatalkan. */
export async function pickImageFromGallery(): Promise<Blob | null> {
  const [first] = await chooseImagesFromGallery(1);
  return first ?? null;
}

interface Encoded {
  blob: Blob;
  width: number;
  height: number;
}

async function encode(
  bitmap: ImageBitmap,
  source: CropArea,
  maxDimension: number,
  quality: number,
  mimeType: string,
): Promise<Encoded> {
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context tidak tersedia');

  // Potong dan perkecil dalam satu panggilan drawImage. Menggabungkan keduanya
  // penting: crop lebih dulu di atas resolusi penuh, sehingga area terpilih
  // tidak diambil dari gambar yang sudah kehilangan detail.
  context.drawImage(
    bitmap,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    width,
    height,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

  if (!blob) throw new Error('Gagal mengubah ukuran gambar');
  return { blob, width, height };
}

/**
 * Hanya membuat thumbnail, tanpa menyentuh berkas penuhnya. Dipakai saat impor:
 * berkas penuh datang apa adanya dari zip dan tidak boleh dikompres ulang —
 * yang hilang dari ekspor cuma thumbnail, karena ia sepenuhnya turunan.
 */
export async function makeThumbnail(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });

  try {
    const mimeType = await preferredFormat();
    const area: CropArea = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const thumb = await encode(bitmap, area, THUMB_DIMENSION, THUMB_QUALITY, mimeType);
    return thumb.blob;
  } finally {
    bitmap.close();
  }
}

export interface ProcessOptions {
  purpose?: ImagePurpose;
  preset?: QualityPreset;
  /** Kalau kosong, seluruh gambar dipakai. */
  crop?: CropArea;
}

/**
 * Menghasilkan berkas penuh sekaligus thumbnail-nya dalam satu kali dekode.
 * Keduanya dibuat dari bitmap yang sama, bukan thumbnail dari hasil resize —
 * kualitasnya lebih baik dan tidak ada dekode kedua.
 */
export async function processImage(
  source: Blob,
  options: ProcessOptions = {},
): Promise<ProcessedImage> {
  const purpose = options.purpose ?? 'cover';
  const profile = QUALITY_PRESETS[options.preset ?? DEFAULT_QUALITY_PRESET];

  // `imageOrientation: 'from-image'` wajib: canvas mengabaikan EXIF orientation
  // kalau tidak diminta, sehingga foto potret muncul dalam posisi rebah.
  // Koordinat crop dari cropper juga mengacu ke gambar yang sudah terkoreksi.
  const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });

  try {
    const mimeType = await preferredFormat();
    const area: CropArea = options.crop ?? {
      x: 0,
      y: 0,
      width: bitmap.width,
      height: bitmap.height,
    };

    const [full, thumb] = await Promise.all([
      encode(bitmap, area, profile[purpose], profile.quality, mimeType),
      encode(bitmap, area, THUMB_DIMENSION, THUMB_QUALITY, mimeType),
    ]);

    return {
      blob: full.blob,
      thumbBlob: thumb.blob,
      width: full.width,
      height: full.height,
      mimeType,
    };
  } finally {
    bitmap.close();
  }
}

/** Ambil satu gambar dari galeri lalu langsung olah. `null` kalau dibatalkan. */
export async function pickAndProcessImage(
  options: ProcessOptions = {},
): Promise<ProcessedImage | null> {
  const source = await pickImageFromGallery();
  if (!source) return null;
  return processImage(source, options);
}

/**
 * Ambil banyak gambar sekaligus lalu olah satu per satu.
 *
 * Sengaja berurutan, bukan `Promise.all`: tiap gambar mengalokasikan bitmap
 * penuh di memori, dan memproses dua puluh foto 4000px secara bersamaan
 * gampang membuat WebView kehabisan memori. Berurutan lebih lambat beberapa
 * detik, tapi tidak pernah membuat aplikasi mati mendadak.
 */
export async function chooseAndProcessImages(
  options: ProcessOptions = {},
  limit = 0,
): Promise<ProcessedImage[]> {
  const sources = await chooseImagesFromGallery(limit);
  const processed: ProcessedImage[] = [];

  for (const source of sources) {
    processed.push(await processImage(source, options));
  }

  return processed;
}
