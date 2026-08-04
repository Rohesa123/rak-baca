import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { taxonomiesRepo } from '../../db/taxonomies.repo';
import type { TaxonomyWithCount } from '../../db/taxonomies.repo';
import type { ProgressUnit, TaxonomyKind } from '../../db/models';
import {
  PROGRESS_UNITS,
  PROGRESS_UNIT_KEY,
  TAXONOMY_KINDS,
  TAXONOMY_KIND_HINT_KEY,
  TAXONOMY_KIND_KEY,
} from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { isConstraintError } from '../../lib/errors';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { TextField } from '../../components/ui/TextField';

const PALETTE = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

interface SwatchesProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

function Swatches({ value, onChange, label }: SwatchesProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={`Warna ${color}`}
          onClick={() => onChange(color)}
          style={{ background: color }}
          className={`h-8 w-8 rounded-full transition-transform ${
            value === color ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Satu halaman untuk keempat sumbu, menggantikan halaman Kategori dan Tag
 * terpisah di v1. Karena keempatnya duduk di satu tabel yang dibedakan `kind`,
 * satu komponen sudah cukup — dan menambah sumbu kelima nanti tidak butuh
 * halaman baru.
 */
export function TaxonomiesPage() {
  const t = useT();
  const [kind, setKind] = useState<TaxonomyKind>('type');

  const rows = useLiveQuery(() => taxonomiesRepo.listWithCounts(kind), [kind]);

  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<TaxonomyWithCount | null>(null);

  const usesColor = kind !== 'type';

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setAddError(t('catalog.nameRequired'));
      return;
    }

    try {
      await taxonomiesRepo.create(kind, trimmed, usesColor ? { color } : {});
      setName('');
      setAddError(null);
    } catch (error) {
      setAddError(
        isConstraintError(error) ? t('catalog.duplicate', { name: trimmed }) : t('catalog.saveFailed'),
      );
    }
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editingId) return;

    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError(t('catalog.nameRequired'));
      return;
    }

    try {
      await taxonomiesRepo.rename(editingId, trimmed);
      setEditingId(null);
      setEditError(null);
    } catch (error) {
      setEditError(
        isConstraintError(error) ? t('catalog.duplicate', { name: trimmed }) : t('catalog.saveFailed'),
      );
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    await taxonomiesRepo.remove(pendingDelete.id);
    setPendingDelete(null);
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <PageHeader title={t('catalog.title')} subtitle={t(TAXONOMY_KIND_HINT_KEY[kind])} />

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {TAXONOMY_KINDS.map((value) => (
          <Chip
            key={value}
            active={kind === value}
            onClick={() => {
              setKind(value);
              setEditingId(null);
              setAddError(null);
            }}
          >
            {t(TAXONOMY_KIND_KEY[value])}
          </Chip>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-5 flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <TextField
            id={`baru-${kind}`}
            label={t('catalog.newValue', { kind: t(TAXONOMY_KIND_KEY[kind]) })}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setAddError(null);
            }}
            error={addError}
          />
          <Button type="submit" className="mb-0.5">
            {t('action.add')}
          </Button>
        </div>

        {usesColor && (
          <Swatches value={color} onChange={setColor} label={t('catalog.color')} />
        )}
      </form>

      <div className="mt-7">
        {rows === undefined ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('catalog.empty')}
            description={t('catalog.emptyHint')}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) =>
              editingId === row.id ? (
                <li key={row.id} className="rounded-xl border border-brand bg-elevated p-3">
                  <form onSubmit={handleSaveEdit} className="flex flex-col gap-3">
                    <TextField
                      id={`ubah-${row.id}`}
                      value={editName}
                      onChange={(event) => {
                        setEditName(event.target.value);
                        setEditError(null);
                      }}
                      error={editError}
                      autoFocus
                    />

                    {usesColor && (
                      <Swatches
                        value={row.color ?? PALETTE[0]}
                        onChange={(next) => void taxonomiesRepo.setColor(row.id, next)}
                        label={t('catalog.color')}
                      />
                    )}

                    {kind === 'type' && (
                      <div className="flex flex-col gap-3">
                        <Chip
                          active={row.tracksProgress !== false}
                          onClick={() =>
                            void taxonomiesRepo.setTypeSettings(row.id, {
                              tracksProgress: row.tracksProgress === false,
                            })
                          }
                        >
                          {row.tracksProgress !== false
                            ? t('catalog.tracksProgress')
                            : t('catalog.noProgress')}
                        </Chip>

                        {row.tracksProgress !== false && (
                          <Select
                            id={`satuan-${row.id}`}
                            label={t('catalog.progressUnit')}
                            value={row.defaultProgressUnit ?? 'chapter'}
                            onChange={(event) =>
                              void taxonomiesRepo.setTypeSettings(row.id, {
                                defaultProgressUnit: event.target.value as ProgressUnit,
                              })
                            }
                          >
                            {PROGRESS_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {t(PROGRESS_UNIT_KEY[unit])}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        {t('action.done')}
                      </Button>
                      <Button type="submit" size="sm">
                        {t('catalog.saveName')}
                      </Button>
                    </div>
                  </form>
                </li>
              ) : (
                <li
                  key={row.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-elevated p-3"
                >
                  {usesColor && (
                    <span
                      aria-hidden="true"
                      style={{ background: row.color ?? '#64748b' }}
                      className="h-4 w-4 shrink-0 rounded-full"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{row.name}</p>
                    <p className="text-xs text-muted">
                      {row.workCount === 0
                        ? t('catalog.unused')
                        : t('catalog.usedBy', { count: row.workCount })}
                      {kind === 'type' &&
                        (row.tracksProgress === false
                          ? ` · ${t('catalog.noProgress').toLowerCase()}`
                          : ` · ${t(PROGRESS_UNIT_KEY[row.defaultProgressUnit ?? 'chapter']).toLowerCase()}`)}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(row.id);
                      setEditName(row.name);
                      setEditError(null);
                    }}
                  >
                    {t('action.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    onClick={() => setPendingDelete(row)}
                  >
                    {t('action.delete')}
                  </Button>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('catalog.deleteTitle', { name: pendingDelete?.name ?? '' })}
        description={
          pendingDelete && pendingDelete.workCount > 0
            ? t('catalog.deleteUsed', { count: pendingDelete.workCount })
            : t('catalog.deleteUnused')
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
