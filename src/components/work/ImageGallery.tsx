import { useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { imagesRepo } from '../../db/images.repo';
import type { WorkImage } from '../../db/models';
import { chooseAndProcessImages } from '../../lib/image';
import { isGalleryPermissionError } from '../../lib/errors';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { useImageQualityStore } from '../../stores/imageQuality.store';
import { useT } from '../../i18n/useT';
import type { Translate } from '../../i18n/useT';
import { Button } from '../ui/Button';
import { ImageViewer } from './ImageViewer';

interface ThumbProps {
  image: WorkImage;
  isPrimary: boolean;
  onOpen: () => void;
  t: Translate;
}

function Thumb({ image, isPrimary, onOpen, t }: ThumbProps) {
  const url = useObjectUrl(image.thumbBlob);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={image.label ?? t('gallery.openImage')}
      className={`relative aspect-2/3 overflow-hidden rounded-lg border bg-elevated ${
        isPrimary ? 'border-brand' : 'border-border'
      }`}
    >
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}

      {image.label && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-left text-[10px] text-white">
          {image.label}
        </span>
      )}

      {image.role === 'art' && (
        <span className="absolute top-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white">
          {t('gallery.artBadge')}
        </span>
      )}
    </button>
  );
}

interface ImageGalleryProps {
  workId: string;
  primaryImageId: string | null;
}

export function ImageGallery({ workId, primaryImageId }: ImageGalleryProps) {
  const images = useLiveQuery(() => imagesRepo.listForWork(workId), [workId]);
  const t = useT();
  const preset = useImageQualityStore((state) => state.preset);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = images ?? [];

  async function handleAdd() {
    setBusy(true);
    setError(null);

    try {
      // Banyak gambar sekaligus sengaja tidak melewati dialog crop: memaksa
      // crop dua puluh kali berturut-turut adalah cara tercepat membuat orang
      // berhenti memakai fiturnya. Crop per gambar menyusul di batch crop.
      const picked = await chooseAndProcessImages({ purpose: 'art', preset });

      for (const image of picked) {
        await imagesRepo.add(workId, 'art', {
          blob: image.blob,
          thumbBlob: image.thumbBlob,
          width: image.width,
          height: image.height,
          mimeType: image.mimeType,
        });
      }
    } catch (caught) {
      // Izin ditolak bukan kegagalan teknis, dan menyebutnya "gagal menambah
      // gambar" menyembunyikan satu-satunya hal yang bisa pengguna lakukan.
      if (isGalleryPermissionError(caught)) {
        setError(t(caught.permanent ? 'gallery.permissionBlocked' : 'gallery.permissionDenied'));
      } else {
        setError(t('gallery.addFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  /** Urutan digeser satu langkah, bukan drag-and-drop — jauh lebih andal disentuh. */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const reordered = [...rows];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);

    await imagesRepo.reorder(reordered.map((row) => row.id));
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          {rows.length > 0
            ? t('gallery.titleWithCount', { count: rows.length })
            : t('gallery.title')}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void handleAdd()} disabled={busy}>
          <ImagePlus size={16} />
          {busy ? t('common.processing') : t('action.add')}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          {t('gallery.empty')}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {rows.map((image, index) => (
            <li key={image.id} className="flex flex-col gap-1">
              <Thumb
                image={image}
                isPrimary={primaryImageId === image.id}
                onOpen={() => setViewerIndex(index)}
                t={t}
              />

              <div className="flex justify-center gap-1">
                <button
                  type="button"
                  aria-label={t('gallery.moveLeft')}
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted disabled:opacity-25"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label={t('gallery.moveRight')}
                  disabled={index === rows.length - 1}
                  onClick={() => void move(index, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted disabled:opacity-25"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ImageViewer
        images={rows}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        primaryImageId={primaryImageId}
      />
    </section>
  );
}
