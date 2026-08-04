import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import type { CropArea } from '../../lib/image';
import { useObjectUrl } from '../../hooks/useObjectUrl';
import { useDialogStore } from '../../stores/dialog.store';
import { useT } from '../../i18n/useT';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

/** Sampul buku hampir selalu 2:3; grid dengan rasio campur terlihat berantakan. */
const COVER_ASPECT = 2 / 3;

interface CropDialogProps {
  /** Berkas mentah yang baru dipilih; `null` menutup dialog. */
  source: Blob | null;
  /** Sampul bertolak dari rasio terkunci, ilustrasi dari rasio bebas. */
  defaultLocked?: boolean;
  /** Peringatan opsional, mis. saat memotong gambar yang sudah terkompresi. */
  warning?: string;
  onCancel: () => void;
  /** `crop` kosong berarti pengguna memilih melewati pemotongan. */
  onConfirm: (crop: CropArea | undefined) => void;
}

export function CropDialog({
  source,
  defaultLocked = true,
  warning,
  onCancel,
  onConfirm,
}: CropDialogProps) {
  const t = useT();
  const open = source !== null;
  const url = useObjectUrl(source);

  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [locked, setLocked] = useState(defaultLocked);
  const [area, setArea] = useState<Area | null>(null);

  const push = useDialogStore((state) => state.push);
  const remove = useDialogStore((state) => state.remove);

  // Tombol Back Android harus menutup dialog ini, bukan memindahkan halaman.
  useEffect(() => {
    if (!open) return;
    push(onCancel);
    return () => remove(onCancel);
  }, [open, push, remove, onCancel]);

  // Setel ulang tiap kali gambar berganti, supaya sisa posisi dari gambar
  // sebelumnya tidak terbawa.
  useEffect(() => {
    if (!open) return;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setLocked(defaultLocked);
  }, [open, source, defaultLocked]);

  if (!open) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/90" />

        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col outline-none"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <Dialog.Title className="px-4 py-3 text-base font-semibold text-white">
            {t('crop.title')}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            {t('crop.description')}
          </Dialog.Description>

          <div className="relative min-h-0 flex-1">
            {url && (
              <Cropper
                image={url}
                crop={crop}
                zoom={zoom}
                rotation={0}
                minZoom={1}
                maxZoom={5}
                aspect={locked ? COVER_ASPECT : undefined}
                objectFit="contain"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setArea(pixels)}
              />
            )}
          </div>

          <div className="flex flex-col gap-3 bg-surface p-4">
            {warning && <p className="text-xs leading-relaxed text-muted">{warning}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <Chip active={locked} onClick={() => setLocked(true)}>
                {t('crop.locked')}
              </Chip>
              <Chip active={!locked} onClick={() => setLocked(false)}>
                {t('crop.free')}
              </Chip>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={onCancel}>
                {t('action.cancel')}
              </Button>
              {/* Melewati crop harus selalu mungkin — sebagian gambar memang
                  tidak perlu dipotong sama sekali. */}
              <Button variant="ghost" className="flex-1" onClick={() => onConfirm(undefined)}>
                {t('action.skip')}
              </Button>
              <Button
                className="flex-1"
                disabled={!area}
                onClick={() =>
                  onConfirm(
                    area
                      ? {
                          x: Math.round(area.x),
                          y: Math.round(area.y),
                          width: Math.round(area.width),
                          height: Math.round(area.height),
                        }
                      : undefined,
                  )
                }
              >
                {t('action.use')}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
