import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { taxonomiesRepo } from '../../db/taxonomies.repo';
import { worksRepo } from '../../db/works.repo';
import type { BulkClassifyPatch } from '../../db/works.repo';
import { useT } from '../../i18n/useT';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Select } from '../ui/Select';

interface BulkClassifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workIds: string[];
  onDone: (changed: number) => void;
}

/** Nilai sentinel untuk "jangan ubah", dibedakan dari "" yang berarti kosongkan. */
const JANGAN_UBAH = '__tetap__';

/**
 * Mengubah klasifikasi banyak karya sekaligus, dari mode pilih yang sudah ada.
 *
 * Berguna persis saat seseorang baru menyadari dua puluh judul lupa diberi tipe
 * — keadaan yang lebih sering terjadi daripada kelihatannya, karena tipe tidak
 * wajib diisi saat mencatat.
 *
 * **Genre dan tema hanya bisa ditambahkan.** Tidak ada tombol yang
 * menggantikan, karena mengganti pada dua puluh karya sekaligus menghapus
 * klasifikasi yang susah payah dibuat dan tidak akan disadari sampai terlambat.
 */
export function BulkClassifyDialog({
  open,
  onOpenChange,
  workIds,
  onDone,
}: BulkClassifyDialogProps) {
  const t = useT();
  const types = useLiveQuery(() => taxonomiesRepo.listByKind('type'), []);
  const statuses = useLiveQuery(() => taxonomiesRepo.listByKind('pubstatus'), []);
  const genres = useLiveQuery(() => taxonomiesRepo.listByKind('genre'), []);
  const themes = useLiveQuery(() => taxonomiesRepo.listByKind('theme'), []);

  const [typeId, setTypeId] = useState(JANGAN_UBAH);
  const [pubStatusId, setPubStatusId] = useState(JANGAN_UBAH);
  const [addGenreIds, setAddGenreIds] = useState<string[]>([]);
  const [addThemeIds, setAddThemeIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setTypeId(JANGAN_UBAH);
    setPubStatusId(JANGAN_UBAH);
    setAddGenreIds([]);
    setAddThemeIds([]);
  }

  const menimpa = typeId !== JANGAN_UBAH || pubStatusId !== JANGAN_UBAH;
  const adaPerubahan = menimpa || addGenreIds.length > 0 || addThemeIds.length > 0;

  const toggle = (list: string[], set: (next: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

  async function apply() {
    setBusy(true);
    try {
      const patch: BulkClassifyPatch = {};
      if (typeId !== JANGAN_UBAH) patch.typeId = typeId || null;
      if (pubStatusId !== JANGAN_UBAH) patch.pubStatusId = pubStatusId || null;
      if (addGenreIds.length) patch.addGenreIds = addGenreIds;
      if (addThemeIds.length) patch.addThemeIds = addThemeIds;

      const changed = await worksRepo.bulkClassify(workIds, patch);
      reset();
      onDone(changed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 transform flex-col rounded-2xl border border-border bg-surface shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <Dialog.Title className="text-base font-semibold text-ink">
              {t('bulk.title', { count: workIds.length })}
            </Dialog.Title>
            <Dialog.Description className="mt-0.5 text-xs text-muted">
              {t('bulk.description')}
            </Dialog.Description>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto px-4 py-4">
            <Select
              id="bulk-tipe"
              label={t('form.type')}
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              <option value={JANGAN_UBAH}>{t('bulk.keep')}</option>
              <option value="">{t('works.filterNoType')}</option>
              {types?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </Select>

            <Select
              id="bulk-status"
              label={t('form.pubStatus')}
              value={pubStatusId}
              onChange={(event) => setPubStatusId(event.target.value)}
            >
              <option value={JANGAN_UBAH}>{t('bulk.keep')}</option>
              <option value="">{t('common.notSet')}</option>
              {statuses?.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </Select>

            {/* Judulnya menyebut "tambah", bukan "genre" begitu saja — kata itu
                yang membedakannya dari menimpa, dan pengguna membacanya sebelum
                menekan apa pun. */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted">{t('bulk.addGenre')}</span>
              <div className="flex flex-wrap gap-2">
                {genres?.map((genre) => (
                  <Chip
                    key={genre.id}
                    active={addGenreIds.includes(genre.id)}
                    onClick={() => toggle(addGenreIds, setAddGenreIds, genre.id)}
                  >
                    {genre.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted">{t('bulk.addTheme')}</span>
              <div className="flex flex-wrap gap-2">
                {themes?.map((theme) => (
                  <Chip
                    key={theme.id}
                    active={addThemeIds.includes(theme.id)}
                    onClick={() => toggle(addThemeIds, setAddThemeIds, theme.id)}
                  >
                    {theme.name}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Peringatan hanya muncul saat memang ada yang akan ditimpa.
                Peringatan permanen berhenti dibaca. */}
            {menimpa && (
              <p className="rounded-xl border border-warning bg-elevated p-3 text-xs leading-relaxed text-ink">
                {t('bulk.overwriteWarning', { count: workIds.length })}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                {t('action.cancel')}
              </Button>
            </Dialog.Close>
            <Button size="sm" disabled={!adaPerubahan || busy} onClick={() => void apply()}>
              {busy ? t('common.saving') : t('action.save')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
