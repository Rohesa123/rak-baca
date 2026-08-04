import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Check, ExternalLink, Minus, Plus, Star } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { readingStatus, worksRepo } from '../../db/works.repo';
import { taxonomiesRepo } from '../../db/taxonomies.repo';
import {
  AGE_RATING_KEY,
  PROGRESS_UNIT_SHORT_KEY,
  READING_STATUS_KEY,
  formatProgress,
} from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { useLanguageStore } from '../../stores/language.store';
import { WorkCover } from '../../components/work/WorkCover';
import { ImageGallery } from '../../components/work/ImageGallery';
import { Button } from '../../components/ui/Button';
import { StaticChip } from '../../components/ui/Chip';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';

function formatDate(timestamp: number, locale: string): string {
  return new Date(timestamp).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-3">
      <span className="text-xs font-medium text-muted">{label}</span>
      <div className="text-ink">{children}</div>
    </div>
  );
}

export function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  // Format tanggal ikut bahasa antarmuka, bukan dipatok ke Indonesia.
  const locale = useLanguageStore((state) => (state.lang === 'en' ? 'en-GB' : 'id-ID'));
  const [confirmOpen, setConfirmOpen] = useState(false);

  const work = useLiveQuery(
    async () => (id ? ((await worksRepo.get(id)) ?? null) : null),
    [id],
  );
  const taxonomies = useLiveQuery(() => taxonomiesRepo.listAll(), []);

  if (work === undefined) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
        <p className="text-sm text-muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (work === null) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
        <PageHeader title={t('form.notFound')} backTo="/" />
        <div className="mt-6">
          <EmptyState
            title={t('form.notFoundTitle')}
            description={t('form.notFoundHint')}
          />
        </div>
      </div>
    );
  }

  const byId = new Map((taxonomies ?? []).map((row) => [row.id, row]));
  const type = work.typeId ? byId.get(work.typeId) : undefined;
  const pubStatus = work.pubStatusId ? byId.get(work.pubStatusId) : undefined;
  const genres = work.genreIds.map((gid) => byId.get(gid)).filter(Boolean);
  const themes = work.themeIds.map((tid) => byId.get(tid)).filter(Boolean);

  const status = readingStatus(work, type);
  const tracksProgress = type?.tracksProgress !== false;
  const showAltTitle = work.altTitle && work.altTitle !== work.title;

  async function handleDelete() {
    if (!work) return;
    await worksRepo.remove(work.id);
    setConfirmOpen(false);
    navigate('/', { replace: true });
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <PageHeader
        title={work.title}
        subtitle={showAltTitle ? work.altTitle : work.author || undefined}
        backTo="/"
      />

      <div className="mt-5 flex justify-center">
        <WorkCover
          imageId={work.primaryImageId}
          alt={t('detail.coverAlt', { title: work.title })}
          className="h-60 w-40 rounded-xl"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => navigate(`/karya/${work.id}/ubah`)}
        >
          {t('action.edit')}
        </Button>

        <Button
          variant="ghost"
          className={work.favoritedAt ? 'text-brand' : ''}
          aria-pressed={Boolean(work.favoritedAt)}
          onClick={() => void worksRepo.toggleFavorite(work.id)}
        >
          <Star size={18} className={work.favoritedAt ? 'fill-current' : ''} />
          {work.favoritedAt ? t('detail.favorite') : t('detail.addFavorite')}
        </Button>

        <Button
          variant="ghost"
          className="flex-1 text-danger"
          onClick={() => setConfirmOpen(true)}
        >
          {t('action.delete')}
        </Button>
      </div>

      {work.sourceUrl && (
        <a
          href={work.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-elevated px-4 py-3 text-sm font-medium text-brand"
        >
          <ExternalLink size={16} aria-hidden="true" />
          {t('detail.continueReading')}
        </a>
      )}

      {tracksProgress && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-elevated p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t('detail.progress')}</p>
            <p className="font-medium text-ink">
              {formatProgress(
                t(PROGRESS_UNIT_SHORT_KEY[work.progressUnit]),
                work.progressCurrent,
                work.progressTotal,
              )}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('detail.decrease')}
              onClick={() => void worksRepo.bumpProgress(work.id, -1)}
              disabled={work.progressCurrent === 0}
            >
              <Minus size={18} />
            </Button>
            <Button
              size="icon"
              aria-label={t('detail.increase')}
              onClick={() => void worksRepo.bumpProgress(work.id, 1)}
            >
              <Plus size={18} />
            </Button>
          </div>
        </div>
      )}

      {/*
        Tombol ini yang membuat karya tanpa total diketahui — ongoing, atau
        cerpen yang progresnya tidak dilacak — tetap bisa dinyatakan selesai.
        Tanpa itu, keduanya tidak akan pernah lolos perbandingan angka.
      */}
      <Button
        variant={work.finishedAt ? 'primary' : 'ghost'}
        className="mt-3 w-full"
        onClick={() => void worksRepo.setFinished(work.id, !work.finishedAt)}
      >
        <Check size={18} />
        {work.finishedAt ? t('detail.finished') : t('detail.markFinished')}
      </Button>

      <div className="mt-5">
        {status && (
          <Field label={t('detail.readingStatus')}>{t(READING_STATUS_KEY[status])}</Field>
        )}

        <Field label={t('form.type')}>
          {type ? type.name : <span className="text-muted">{t('works.filterNoType')}</span>}
        </Field>

        <Field label={t('form.pubStatus')}>
          {pubStatus ? (
            <StaticChip color={pubStatus.color}>{pubStatus.name}</StaticChip>
          ) : (
            <span className="text-muted">{t('common.notSet')}</span>
          )}
        </Field>

        <Field label={t('form.author')}>
          {work.author || <span className="text-muted">{t('common.notSet')}</span>}
        </Field>

        <Field label={t('form.ageRating')}>
          {work.ageRating ? (
            t(AGE_RATING_KEY[work.ageRating])
          ) : (
            <span className="text-muted">{t('common.notSet')}</span>
          )}
        </Field>

        <Field label={t('form.rating')}>
          {work.personalRating !== null ? (
            t('detail.ratingValue', { score: work.personalRating })
          ) : (
            <span className="text-muted">{t('detail.notRated')}</span>
          )}
        </Field>

        <Field label={t('taxonomy.genre')}>
          {genres.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {genres.map((row) => (
                <StaticChip key={row!.id}>{row!.name}</StaticChip>
              ))}
            </div>
          ) : (
            <span className="text-muted">{t('common.none')}</span>
          )}
        </Field>

        <Field label={t('taxonomy.theme')}>
          {themes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {themes.map((row) => (
                <StaticChip key={row!.id}>{row!.name}</StaticChip>
              ))}
            </div>
          ) : (
            <span className="text-muted">{t('common.none')}</span>
          )}
        </Field>

        <Field label={t('form.synopsis')}>
          {work.synopsis ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{work.synopsis}</p>
          ) : (
            <span className="text-muted">{t('common.notSet')}</span>
          )}
        </Field>

        <Field label={t('form.notes')}>
          {work.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{work.notes}</p>
          ) : (
            <span className="text-muted">{t('detail.noNotes')}</span>
          )}
        </Field>

        <Field label={t('detail.added')}>{formatDate(work.createdAt, locale)}</Field>

        {work.lastReadAt && (
          <Field label={t('sort.lastRead')}>{formatDate(work.lastReadAt, locale)}</Field>
        )}
      </div>

      <ImageGallery workId={work.id} primaryImageId={work.primaryImageId} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('detail.deleteTitle', { title: work.title })}
        description={t('detail.deleteBody')}
        onConfirm={handleDelete}
      />
    </div>
  );
}
