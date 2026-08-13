import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { computeStats } from '../../lib/stats';
import type { Tally } from '../../lib/stats';
import { PROGRESS_UNIT_KEY } from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

interface BigProps {
  label: string;
  value: string;
}

function Big({ label, value }: BigProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border bg-elevated p-3">
      <span className="text-2xl font-semibold text-ink">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

interface BarsProps {
  title: string;
  rows: Tally[];
  emptyLabel: string;
}

/**
 * Batang proporsional terhadap nilai terbesar, bukan terhadap total.
 *
 * Terhadap total, sebaran yang merata menghasilkan batang-batang pendek yang
 * sama-sama tak terbaca. Yang ingin dilihat di sini perbandingan antar baris,
 * bukan porsinya terhadap keseluruhan — apalagi satu karya bisa punya banyak
 * genre sekaligus, sehingga jumlah seluruh baris memang melebihi jumlah karya.
 */
function Bars({ title, rows, emptyLabel }: BarsProps) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.count), 0);

  return (
    <section className="mt-7 flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted">{title}</h2>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.name} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">{row.name}</span>
                <span className="shrink-0 text-sm text-muted">{row.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${max === 0 ? 0 : (row.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatsPage() {
  const t = useT();

  const data = useLiveQuery(async () => {
    const [works, taxonomies] = await Promise.all([
      db.works.toArray(),
      db.taxonomies.toArray(),
    ]);
    return computeStats(works, taxonomies);
  }, []);

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
        <PageHeader title={t('stats.title')} backTo="/pengaturan" />
        <p className="mt-6 text-sm text-muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (data.total === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
        <PageHeader title={t('stats.title')} backTo="/pengaturan" />
        <div className="mt-8">
          <EmptyState title={t('works.empty')} description={t('stats.emptyHint')} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <PageHeader title={t('stats.title')} backTo="/pengaturan" />

      <div className="mt-6 grid grid-cols-3 gap-2">
        <Big label={t('stats.total')} value={String(data.total)} />
        <Big label={t('stats.reading')} value={String(data.byStatus.berjalan)} />
        <Big label={t('stats.finished')} value={String(data.byStatus.selesai)} />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <Big label={t('stats.notStarted')} value={String(data.byStatus.belum)} />
        <Big label={t('stats.favorites')} value={String(data.favorites)} />
        <Big
          label={t('stats.avgRating')}
          value={data.averageRating === null ? '—' : data.averageRating.toFixed(1)}
        />
      </div>

      {data.finishedThisYear > 0 && (
        <p className="mt-3 text-sm text-muted">
          {t('stats.thisYear', { count: data.finishedThisYear })}
        </p>
      )}

      {/* Dipisah per satuan: menjumlahkan chapter dengan halaman menghasilkan
          angka yang terlihat berarti padahal tidak. */}
      {data.progressByUnit.length > 0 && (
        <section className="mt-7 flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted">{t('stats.readSoFar')}</h2>
          <ul className="flex flex-col gap-1">
            {data.progressByUnit.map(({ unit, total }) => (
              <li key={unit} className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-ink">{t(PROGRESS_UNIT_KEY[unit])}</span>
                <span className="text-sm text-muted">{total.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Bars title={t('stats.topTypes')} rows={data.topTypes} emptyLabel={t('common.none')} />
      <Bars title={t('stats.topGenres')} rows={data.topGenres} emptyLabel={t('common.none')} />
      <Bars title={t('stats.topThemes')} rows={data.topThemes} emptyLabel={t('common.none')} />

      {data.untracked > 0 && (
        <p className="mt-7 text-xs leading-relaxed text-muted">
          {t('stats.untrackedNote', { count: data.untracked })}
        </p>
      )}
    </div>
  );
}
