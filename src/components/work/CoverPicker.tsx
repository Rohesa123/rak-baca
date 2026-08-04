import { Suspense, lazy, useState } from 'react';
import { pickImageFromGallery, processImage } from '../../lib/image';
import type { CropArea, ProcessedImage } from '../../lib/image';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { useImageQualityStore } from '../../stores/imageQuality.store';
import { useT } from '../../i18n/useT';
import { Button } from '../ui/Button';

/**
 * Dimuat terpisah. `react-easy-crop` beserta CSS-nya sekitar 28 KB, dan hanya
 * dibutuhkan pada saat seseorang benar-benar memilih gambar — tidak perlu ikut
 * memberatkan bundel awal yang dimuat di setiap pembukaan aplikasi.
 */
const CropDialog = lazy(() =>
  import('./CropDialog').then((module) => ({ default: module.CropDialog })),
);

/**
 * Gambar disimpan di tabel terpisah dari karya, dan saat mode tambah karyanya
 * belum punya id. Karena itu form hanya menyimpan *niat* perubahannya, lalu
 * WorkFormPage yang menerapkannya setelah id karya pasti ada.
 */
export type CoverDraft =
  | { kind: 'unchanged' }
  | { kind: 'removed' }
  | { kind: 'replaced'; image: ProcessedImage };

interface CoverPickerProps {
  /** Thumbnail sampul yang sudah tersimpan, hanya terisi pada mode ubah. */
  existingThumb?: Blob | null;
  value: CoverDraft;
  onChange: (draft: CoverDraft) => void;
}

function formatSize(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

export function CoverPicker({ existingThumb, value, onChange }: CoverPickerProps) {
  const t = useT();
  const preset = useImageQualityStore((state) => state.preset);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Berkas mentah yang menunggu dipotong; membuka CropDialog saat terisi. */
  const [pendingSource, setPendingSource] = useState<Blob | null>(null);

  const previewBlob =
    value.kind === 'replaced'
      ? value.image.thumbBlob
      : value.kind === 'removed'
        ? null
        : (existingThumb ?? null);

  const url = useObjectUrl(previewBlob);

  async function handlePick() {
    setBusy(true);
    setError(null);

    try {
      const source = await pickImageFromGallery();
      // null = pengguna membatalkan; biarkan sampul apa adanya.
      if (source) setPendingSource(source);
    } catch {
      setError(t('cover.loadFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCropConfirm(crop: CropArea | undefined) {
    const source = pendingSource;
    setPendingSource(null);
    if (!source) return;

    setBusy(true);
    try {
      const image = await processImage(source, { purpose: 'cover', preset, crop });
      onChange({ kind: 'replaced', image });
    } catch {
      setError(t('cover.processFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted">{t('form.section.cover')}</span>

      <div className="flex gap-3">
        <div className="flex h-32 w-22 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-elevated text-muted">
          {url ? (
            <img src={url} alt={t('cover.preview')} className="h-full w-full object-cover" />
          ) : (
            <span className="px-2 text-center text-xs">{t('cover.none')}</span>
          )}
        </div>

        <div className="flex flex-1 flex-col items-start gap-2">
          <Button variant="ghost" size="sm" onClick={() => void handlePick()} disabled={busy}>
            {busy ? t('common.processing') : url ? t('cover.replace') : t('cover.pick')}
          </Button>

          {url && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              onClick={() => onChange({ kind: 'removed' })}
            >
              {t('cover.remove')}
            </Button>
          )}

          {value.kind === 'replaced' && (
            <p className="text-xs text-muted">
              {value.image.width}×{value.image.height} px ·{' '}
              {formatSize(value.image.blob.size)} ·{' '}
              {value.image.mimeType.replace('image/', '').toUpperCase()}
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Dirender hanya saat dibutuhkan, supaya chunk cropper benar-benar
          tertunda sampai ada gambar yang dipilih. */}
      {pendingSource && (
        <Suspense fallback={null}>
          <CropDialog
            source={pendingSource}
            onCancel={() => setPendingSource(null)}
            onConfirm={(crop) => void handleCropConfirm(crop)}
          />
        </Suspense>
      )}
    </div>
  );
}
