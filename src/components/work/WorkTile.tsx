import { Link } from 'react-router';
import { Star } from 'lucide-react';
import type { Taxonomy, Work } from '../../db/models';
import { PROGRESS_UNIT_SHORT_KEY, formatProgress } from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { WorkCover } from './WorkCover';

interface WorkTileProps {
  work: Work;
  taxonomyById: Map<string, Taxonomy>;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}

/**
 * Kartu untuk mode Sampul: petak berisi gambar, judul, dan posisi baca.
 *
 * **Tidak membawa kendali apa pun** — bukan kelalaian, melainkan keputusan.
 * Mode ini untuk menelusuri dengan mata; menyelipkan tombol +1 di atas petak
 * selebar seratus piksel hanya menghasilkan sasaran sentuh yang meleset.
 * Mengetuknya membuka halaman detail, dan di sanalah semua kendali berada.
 *
 * Progres tetap ditampilkan. Itu satu-satunya informasi yang jadi alasan
 * aplikasi ini ada; mode yang membuangnya bukan mode tampilan melainkan
 * aplikasi lain.
 */
export function WorkTile({
  work,
  taxonomyById,
  selectable,
  selected,
  onToggleSelect,
}: WorkTileProps) {
  const t = useT();
  const type = work.typeId ? taxonomyById.get(work.typeId) : undefined;
  const tracksProgress = type?.tracksProgress !== false;

  const isi = (
    <>
      <div className="relative">
        <WorkCover
          imageId={work.primaryImageId}
          alt={`Sampul ${work.title}`}
          className="aspect-2/3 w-full"
        />
        {work.favoritedAt && (
          <Star
            size={14}
            className="absolute top-1 right-1 fill-current text-brand drop-shadow"
            aria-label={t('card.favorite')}
          />
        )}
      </div>

      <span className="line-clamp-2 text-xs leading-snug text-ink">{work.title}</span>

      {tracksProgress && (
        <span className="text-[10px] text-muted">
          {formatProgress(
            t(PROGRESS_UNIT_SHORT_KEY[work.progressUnit]),
            work.progressCurrent,
            work.progressTotal,
          )}
        </span>
      )}
    </>
  );

  if (selectable) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onToggleSelect}
        className={`flex flex-col gap-1 rounded-xl border p-1.5 text-left ${
          selected ? 'border-brand bg-brand/10' : 'border-transparent'
        }`}
      >
        {isi}
      </button>
    );
  }

  return (
    <Link
      to={`/karya/${work.id}`}
      aria-label={t('card.open', { title: work.title })}
      className="flex flex-col gap-1 rounded-xl border border-transparent p-1.5"
    >
      {isi}
    </Link>
  );
}
