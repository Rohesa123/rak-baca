import { Link } from 'react-router';
import { Check, Plus, Star } from 'lucide-react';
import type { Taxonomy, Work } from '../../db/models';
import { readingStatus, worksRepo } from '../../db/works.repo';
import {
  PROGRESS_UNIT_SHORT_KEY,
  READING_STATUS_KEY,
  formatProgress,
} from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { StaticChip } from '../ui/Chip';
import { WorkCover } from './WorkCover';

interface WorkCardProps {
  work: Work;
  taxonomyById: Map<string, Taxonomy>;
  /** Saat aktif, mengetuk kartu memilihnya alih-alih membuka detail. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function WorkCard({
  work,
  taxonomyById,
  selectable = false,
  selected = false,
  onToggleSelect,
}: WorkCardProps) {
  const t = useT();
  const type = work.typeId ? taxonomyById.get(work.typeId) : undefined;
  const pubStatus = work.pubStatusId ? taxonomyById.get(work.pubStatusId) : undefined;
  const status = readingStatus(work, type);

  const tracksProgress = type?.tracksProgress !== false;
  const showAltTitle = work.altTitle && work.altTitle !== work.title;

  const body = (
    <>
      <WorkCover
          imageId={work.primaryImageId}
          alt={`Sampul ${work.title}`}
          className="h-20 w-14"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="min-w-0">
            <div className="flex items-start gap-1.5">
              <p className="min-w-0 flex-1 truncate font-medium text-ink">{work.title}</p>
              {work.favoritedAt && (
                <Star
                  size={15}
                  className="mt-0.5 shrink-0 fill-current text-brand"
                  aria-label={t('card.favorite')}
                />
              )}
            </div>

            {showAltTitle && (
              <p className="truncate text-xs text-muted">{work.altTitle}</p>
            )}
            {work.author && (
              <p className="truncate text-sm text-muted">{work.author}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {type && <StaticChip>{type.name}</StaticChip>}
            {pubStatus && <StaticChip color={pubStatus.color}>{pubStatus.name}</StaticChip>}
            {status && <StaticChip>{t(READING_STATUS_KEY[status])}</StaticChip>}
            {work.personalRating !== null && (
              <StaticChip>★ {work.personalRating}</StaticChip>
            )}
          </div>

          {tracksProgress && (
            <p className="text-xs text-muted">
              {formatProgress(
                t(PROGRESS_UNIT_SHORT_KEY[work.progressUnit]),
                work.progressCurrent,
                work.progressTotal,
              )}
            </p>
          )}
        </div>
    </>
  );

  // Dalam mode pilih, seluruh kartu jadi tombol pilih — navigasi ke detail dan
  // tombol tambah progres sengaja dinonaktifkan supaya tidak ada ketukan yang
  // menghasilkan akibat tak terduga.
  if (selectable) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggleSelect}
        className={`flex w-full gap-3 rounded-xl border p-3 text-left ${
          selected ? 'border-brand bg-brand/10' : 'border-border bg-elevated'
        }`}
      >
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-md border ${
            selected ? 'border-brand bg-brand text-on-brand' : 'border-border'
          }`}
        >
          {selected && <Check size={14} />}
        </span>
        {body}
      </button>
    );
  }

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-elevated p-3">
      <Link
        to={`/karya/${work.id}`}
        className="flex min-w-0 flex-1 gap-3"
        aria-label={t('card.open', { title: work.title })}
      >
        {body}
      </Link>

      {/*
        Tombol ini sengaja berada di LUAR <Link>, bukan di dalamnya: <button>
        di dalam <a> itu HTML tidak sah, dan menaikkan progres tidak boleh ikut
        membuka halaman detail. Inilah aksi yang paling sering dipakai — kalau
        harus lewat form, pencatatan progres berhenti setelah minggu pertama.
      */}
      {tracksProgress && (
        <button
          type="button"
          aria-label={t('card.bumpProgress', { title: work.title })}
          onClick={() => void worksRepo.bumpProgress(work.id)}
          className="flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl bg-surface text-brand active:bg-border"
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
