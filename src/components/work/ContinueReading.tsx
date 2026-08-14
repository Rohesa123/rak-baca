import { Link } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { worksRepo } from '../../db/works.repo';
import { PROGRESS_UNIT_SHORT_KEY, formatProgress } from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { WorkCover } from './WorkCover';

/**
 * Baris "lanjutkan membaca" di puncak halaman Rak.
 *
 * Dibuat mendatar dan ringkas dengan sengaja. Kalau bentuknya sama dengan
 * kartu di daftar bawahnya, ia terbaca sebagai isi yang terulang dan pengguna
 * berhenti membedakan keduanya. Sampul dalam ukuran kecil justru bagian yang
 * paling cepat dikenali mata.
 *
 * Tidak dirender sama sekali kalau tidak ada yang layak dilanjutkan — bukan
 * ditampilkan sebagai bagian kosong. Bagian kosong yang permanen hanya
 * mengambil ruang di layar tanpa pernah berguna.
 */
export function ContinueReading() {
  const t = useT();
  const rows = useLiveQuery(() => worksRepo.continueReading(3), []);

  if (!rows || rows.length === 0) return null;

  return (
    <section className="mt-5">
      <h2 className="text-sm font-medium text-muted">{t('works.continue')}</h2>

      <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-1">
        {rows.map((work) => (
          <div key={work.id} className="flex w-20 shrink-0 flex-col gap-1.5">
            {/* Tautan sumber berada di luar tautan kartu, bukan di dalamnya:
                <a> bersarang bukan HTML yang sah. */}
            <Link to={`/karya/${work.id}`} className="flex flex-col gap-1.5">
              <WorkCover
                imageId={work.primaryImageId}
                alt={`Sampul ${work.title}`}
                className="h-28 w-20"
              />
              <span className="line-clamp-2 text-xs leading-snug text-ink">{work.title}</span>
              <span className="text-[10px] text-muted">
                {formatProgress(
                  t(PROGRESS_UNIT_SHORT_KEY[work.progressUnit]),
                  work.progressCurrent,
                  work.progressTotal,
                )}
              </span>
            </Link>

            {/* Di baris inilah tautan paling berguna: seluruh isinya memang
                karya yang sedang dibaca. */}
            {work.sourceUrl && (
              <a
                href={work.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('card.openSource', { title: work.title })}
                className="flex items-center gap-1 text-[10px] text-brand"
              >
                <ExternalLink size={11} aria-hidden="true" />
                {t('card.openSourceShort')}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
