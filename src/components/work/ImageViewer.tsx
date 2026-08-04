import { Suspense, lazy, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Crop, Star, Trash2, X } from 'lucide-react';
import { imagesRepo } from '../../db/images.repo';
import { worksRepo } from '../../db/works.repo';
import type { WorkImage } from '../../db/models';
import { processImage } from '../../lib/image';
import type { CropArea } from '../../lib/image';
import { useImageQualityStore } from '../../stores/imageQuality.store';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { useDialogStore } from '../../stores/dialog.store';
import { useT } from '../../i18n/useT';
import { Button } from '../ui/Button';
import { TextField } from '../ui/TextField';

/** Chunk cropper ditunda sampai tombol potong benar-benar ditekan. */
const CropDialog = lazy(() =>
  import('./CropDialog').then((module) => ({ default: module.CropDialog })),
);

interface ImageViewerProps {
  images: WorkImage[];
  /** Indeks gambar yang dibuka; `null` menutup penampil. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  primaryImageId: string | null;
}

/**
 * Penampil layar penuh. Hanya di sinilah berkas ukuran penuh dibaca — grid dan
 * kartu selalu memakai thumbnail.
 */
export function ImageViewer({
  images,
  index,
  onIndexChange,
  primaryImageId,
}: ImageViewerProps) {
  const t = useT();
  const open = index !== null;
  const image = index === null ? undefined : images[index];

  const [fullBlob, setFullBlob] = useState<Blob | null>(null);
  const [label, setLabel] = useState('');
  const [cropSource, setCropSource] = useState<Blob | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const preset = useImageQualityStore((state) => state.preset);

  const push = useDialogStore((state) => state.push);
  const remove = useDialogStore((state) => state.remove);

  // Tombol Back Android harus menutup penampil lebih dulu, bukan memindahkan
  // halaman di belakangnya.
  useEffect(() => {
    if (!open) return;
    const close = () => onIndexChange(null);
    push(close);
    return () => remove(close);
  }, [open, push, remove, onIndexChange]);

  useEffect(() => {
    if (!image) {
      setFullBlob(null);
      return;
    }

    setLabel(image.label ?? '');

    let cancelled = false;
    void imagesRepo.getFull(image.id).then((blob) => {
      if (!cancelled) setFullBlob(blob ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [image]);

  // Selagi berkas penuh dimuat, thumbnail dipakai sebagai pengisi supaya tidak
  // ada kedipan kosong.
  const url = useObjectUrl(fullBlob ?? image?.thumbBlob);

  if (!image || index === null) return null;

  const isPrimary = primaryImageId === image.id;
  // Disalin ke variabel lokal: TypeScript melepas penyempitan tipe di dalam
  // badan fungsi, karena fungsinya bisa saja dipanggil setelah prop berubah.
  const currentIndex = index;
  const currentImage = image;

  async function handleCropConfirm(crop: CropArea | undefined) {
    const source = cropSource;
    setCropSource(null);
    if (!source || !crop) return;

    setCropError(null);

    try {
      // Peruntukannya mengikuti peran gambar, jadi ilustrasi tetap dapat jatah
      // resolusi yang lebih besar daripada sampul.
      const next = await processImage(source, {
        purpose: currentImage.role === 'cover' ? 'cover' : 'art',
        preset,
        crop,
      });

      await imagesRepo.replaceContent(currentImage.id, next);
      setFullBlob(next.blob);
    } catch {
      setCropError(t('viewer.cropFailed'));
    }
  }

  async function handleDelete() {
    await imagesRepo.remove(currentImage.id);
    // Mundur ke gambar sebelumnya, atau tutup kalau ini yang terakhir.
    onIndexChange(images.length <= 1 ? null : Math.max(0, currentIndex - 1));
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/90" />

        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <Dialog.Title className="sr-only">
            {image.label ?? t('viewer.fallbackTitle')}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t('viewer.imageOf', { index: index + 1, total: images.length })}
          </Dialog.Description>

          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-white/70">
              {index + 1} / {images.length}
            </span>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={t('action.close')}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
              >
                <X size={22} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 items-center gap-1 px-1">
            <button
              type="button"
              aria-label={t('viewer.prev')}
              disabled={index === 0}
              onClick={() => onIndexChange(index - 1)}
              className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-25"
            >
              <ChevronLeft size={24} />
            </button>

            {url && (
              <img
                src={url}
                alt={image.label ?? ''}
                className="max-h-full min-h-0 flex-1 object-contain"
              />
            )}

            <button
              type="button"
              aria-label={t('viewer.next')}
              disabled={index >= images.length - 1}
              onClick={() => onIndexChange(index + 1)}
              className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-25"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex flex-col gap-3 bg-surface p-4">
            <TextField
              id="label-gambar"
              label={t('viewer.label')}
              placeholder={t('viewer.labelPlaceholder')}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              onBlur={() => void imagesRepo.setLabel(image.id, label)}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void imagesRepo.setRole(image.id, image.role === 'cover' ? 'art' : 'cover')
                }
              >
                {image.role === 'cover' ? t('viewer.makeArt') : t('viewer.makeCover')}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                disabled={isPrimary || image.role !== 'cover'}
                onClick={() => void worksRepo.setPrimaryImage(image.workId, image.id)}
              >
                <Star size={16} className={isPrimary ? 'fill-current' : ''} />
                {isPrimary ? t('viewer.primary') : t('viewer.makePrimary')}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                disabled={!fullBlob}
                onClick={() => setCropSource(fullBlob)}
              >
                <Crop size={16} />
                {t('viewer.crop')}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() => void handleDelete()}
              >
                <Trash2 size={16} />
                {t('action.delete')}
              </Button>
            </div>

            {cropError && (
              <p role="alert" className="text-xs text-danger">
                {cropError}
              </p>
            )}
          </div>

          {cropSource && (
            <Suspense fallback={null}>
              <CropDialog
                source={cropSource}
                defaultLocked={currentImage.role === 'cover'}
                warning={t('viewer.cropWarning')}
                onCancel={() => setCropSource(null)}
                onConfirm={(crop) => void handleCropConfirm(crop)}
              />
            </Suspense>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
