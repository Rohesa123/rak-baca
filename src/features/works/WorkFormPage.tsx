import { useNavigate, useParams } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { worksRepo } from '../../db/works.repo';
import { imagesRepo } from '../../db/images.repo';
import { WorkForm, EMPTY_WORK_FORM } from '../../components/work/WorkForm';
import type { WorkFormValues } from '../../components/work/WorkForm';
import type { CoverDraft } from '../../components/work/CoverPicker';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { useT } from '../../i18n/useT';

/** Kolom angka disimpan sebagai string di form supaya boleh kosong saat diketik. */
function toNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function toNullableNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function WorkFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const t = useT();

  // `undefined` = masih memuat, `null` = mode tambah atau karya tidak ditemukan.
  const existing = useLiveQuery(
    async () => (id ? ((await worksRepo.get(id)) ?? null) : null),
    [id],
  );

  const coverImage = useLiveQuery(
    async () => {
      if (!existing?.primaryImageId) return null;
      return (await imagesRepo.get(existing.primaryImageId)) ?? null;
    },
    [existing?.primaryImageId],
  );

  async function handleSubmit(values: WorkFormValues, cover: CoverDraft) {
    const trimmedTitle = values.title.trim();

    const payload = {
      title: trimmedTitle,
      altTitle: values.altTitle.trim() || trimmedTitle,
      author: values.author.trim(),
      typeId: values.typeId,
      pubStatusId: values.pubStatusId,
      ageRating: values.ageRating,
      genreIds: values.genreIds,
      themeIds: values.themeIds,
      progressUnit: values.progressUnit,
      progressCurrent: toNumber(values.progressCurrent, 0),
      progressTotal: toNullableNumber(values.progressTotal),
      personalRating: toNullableNumber(values.personalRating),
      // undefined membuat repo menghapus field-nya, bukan menyimpan string kosong.
      synopsis: values.synopsis.trim() || undefined,
      notes: values.notes.trim() || undefined,
      sourceUrl: values.sourceUrl.trim() || undefined,
    };

    // Gambar baru bisa disimpan setelah id karya pasti ada — pada mode tambah,
    // id itu baru lahir dari create() di bawah.
    let workId: string;

    if (existing) {
      await worksRepo.update(existing.id, payload);
      workId = existing.id;
    } else {
      workId = (await worksRepo.create(payload)).id;
    }

    if (cover.kind !== 'unchanged') {
      // Mode satu sampul: buang sampul lama dulu, baru pasang yang baru.
      // Galeri banyak gambar menyusul di batch berikutnya.
      const existingCovers = await imagesRepo.listForWork(workId, 'cover');
      for (const image of existingCovers) await imagesRepo.remove(image.id);

      if (cover.kind === 'replaced') {
        await imagesRepo.add(workId, 'cover', {
          blob: cover.image.blob,
          thumbBlob: cover.image.thumbBlob,
          width: cover.image.width,
          height: cover.image.height,
          mimeType: cover.image.mimeType,
        });
      }
    }

    navigate(`/karya/${workId}`, { replace: true });
  }

  if (isEdit && existing === undefined) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
        <p className="text-sm text-muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (isEdit && existing === null) {
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

  const initialValues: WorkFormValues = existing
    ? {
        title: existing.title,
        altTitle: existing.altTitle,
        author: existing.author,
        typeId: existing.typeId,
        pubStatusId: existing.pubStatusId,
        ageRating: existing.ageRating,
        genreIds: existing.genreIds,
        themeIds: existing.themeIds,
        sourceUrl: existing.sourceUrl ?? '',
        progressUnit: existing.progressUnit,
        progressCurrent: String(existing.progressCurrent),
        progressTotal: existing.progressTotal === null ? '' : String(existing.progressTotal),
        personalRating:
          existing.personalRating === null ? '' : String(existing.personalRating),
        synopsis: existing.synopsis ?? '',
        notes: existing.notes ?? '',
      }
    : EMPTY_WORK_FORM;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <PageHeader
        title={existing ? t('form.edit') : t('form.add')}
        backTo={existing ? `/karya/${existing.id}` : '/'}
      />

      <WorkForm
        initialValues={initialValues}
        workId={existing?.id}
        existingCoverThumb={coverImage?.thumbBlob ?? null}
        submitLabel={existing ? t('action.save') : t('action.add')}
        onSubmit={handleSubmit}
        onCancel={() => navigate(existing ? `/karya/${existing.id}` : '/')}
      />
    </div>
  );
}
