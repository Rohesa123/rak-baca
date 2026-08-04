import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { impactFeedback } from '../../lib/native';
import { useDialogStore } from '../../stores/dialog.store';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

/**
 * AlertDialog Radix, bukan `window.confirm`: dialog native memblokir thread dan
 * tampilannya di WebView Android jelek. Radix juga menangani focus trap dan
 * tombol Escape tanpa perlu ditulis manual.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  onConfirm,
}: ConfirmDialogProps) {
  const push = useDialogStore((state) => state.push);
  const remove = useDialogStore((state) => state.remove);

  // Ref "nilai terbaru": onOpenChange biasanya arrow function inline yang
  // berganti tiap render. Tanpa ref ini, dialog akan mendaftar-ulang terus
  // menerus ke tumpukan tombol Back.
  const latestOnOpenChange = useRef(onOpenChange);
  useEffect(() => {
    latestOnOpenChange.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;

    const close = () => latestOnOpenChange.current(false);
    push(close);

    return () => remove(close);
  }, [open, push, remove]);

  function handleConfirm() {
    void impactFeedback();
    onConfirm();
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/50" />

        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-5 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold text-ink">
            {title}
          </AlertDialog.Title>

          <AlertDialog.Description className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </AlertDialog.Description>

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">{cancelLabel}</Button>
            </AlertDialog.Cancel>

            <AlertDialog.Action asChild>
              <Button variant="danger" onClick={handleConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
