import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router';
import { draftHasContent, draftStore } from '../../lib/draft';
import { useLiveQuery } from 'dexie-react-hooks';
import { taxonomiesRepo } from '../../db/taxonomies.repo';
import { worksRepo } from '../../db/works.repo';
import { AGE_RATINGS } from '../../db/models';
import type { AgeRating, ProgressUnit, Work } from '../../db/models';
import { AGE_RATING_KEY, PROGRESS_UNITS, PROGRESS_UNIT_KEY } from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Select } from '../ui/Select';
import { TextField } from '../ui/TextField';
import { Textarea } from '../ui/Textarea';
import { CoverPicker } from './CoverPicker';
import type { CoverDraft } from './CoverPicker';
import { TaxonomyPicker } from './TaxonomyPicker';

export interface WorkFormValues {
  title: string;
  altTitle: string;
  author: string;
  typeId: string | null;
  pubStatusId: string | null;
  ageRating: AgeRating | null;
  genreIds: string[];
  themeIds: string[];
  sourceUrl: string;
  progressUnit: ProgressUnit;
  /** Disimpan sebagai string supaya kolomnya boleh kosong saat diketik. */
  progressCurrent: string;
  progressTotal: string;
  personalRating: string;
  synopsis: string;
  notes: string;
}

export const EMPTY_WORK_FORM: WorkFormValues = {
  title: '',
  altTitle: '',
  author: '',
  typeId: null,
  pubStatusId: null,
  ageRating: null,
  genreIds: [],
  themeIds: [],
  sourceUrl: '',
  progressUnit: 'chapter',
  progressCurrent: '0',
  progressTotal: '',
  personalRating: '',
  synopsis: '',
  notes: '',
};

interface SectionProps {
  title: string;
  children: ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

interface WorkFormProps {
  initialValues: WorkFormValues;
  /** Diisi saat menyunting, supaya karya tidak memperingatkan tentang dirinya sendiri. */
  workId?: string;
  existingCoverThumb?: Blob | null;
  submitLabel: string;
  onSubmit: (values: WorkFormValues, cover: CoverDraft) => Promise<void>;
  onCancel: () => void;
}

export function WorkForm({
  initialValues,
  workId,
  existingCoverThumb,
  submitLabel,
  onSubmit,
  onCancel,
}: WorkFormProps) {
  const t = useT();
  const types = useLiveQuery(() => taxonomiesRepo.listByKind('type'), []);
  const statuses = useLiveQuery(() => taxonomiesRepo.listByKind('pubstatus'), []);

  const [values, setValues] = useState<WorkFormValues>(initialValues);
  const [cover, setCover] = useState<CoverDraft>({ kind: 'unchanged' });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [similar, setSimilar] = useState<Work[]>([]);

  // Draf hanya berlaku untuk karya baru. Pada form sunting, data aslinya masih
  // utuh di database — yang hilang saat berpindah menu hanyalah perubahan yang
  // belum disimpan, dan memulihkannya diam-diam justru berisiko menimpa nilai
  // yang sudah benar.
  const isNew = !workId;
  const [pendingDraft, setPendingDraft] = useState<WorkFormValues | null>(null);
  // Form sunting tidak pernah memeriksa draf, jadi keadaannya sudah selesai
  // sejak awal. Diturunkan dari nilai awal ketimbang di-set di dalam effect —
  // menyetel state secara sinkron di dalam effect memicu render berlapis.
  const [draftChecked, setDraftChecked] = useState(!isNew);

  useEffect(() => {
    if (!isNew) return;

    let cancelled = false;
    void draftStore.load().then((saved) => {
      if (cancelled) return;
      // Ditawarkan, tidak pernah dipulihkan diam-diam. Pengguna yang sengaja
      // meninggalkan isian akan bingung melihatnya muncul kembali sendiri.
      if (saved && draftHasContent(saved)) setPendingDraft(saved);
      setDraftChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isNew]);

  useEffect(() => {
    // Menunggu pertanyaan draf selesai dijawab. Tanpa penjagaan ini, form yang
    // masih kosong akan menimpa draf yang justru sedang ditawarkan.
    if (!isNew || !draftChecked || pendingDraft) return;
    if (!draftHasContent(values)) return;

    // Ditunda supaya tidak menulis ke penyimpanan pada setiap ketikan.
    const timer = setTimeout(() => void draftStore.save(values), 800);
    return () => clearTimeout(timer);
  }, [values, isNew, draftChecked, pendingDraft]);

  /**
   * Dicek saat kolom judul kehilangan fokus, bukan pada setiap ketikan.
   * Mencari di tiap ketikan berarti kueri berulang dan peringatan yang
   * berkedip-kedip saat judul masih setengah diketik.
   */
  async function checkSimilarTitles() {
    const title = values.title.trim();
    if (!title) {
      setSimilar([]);
      return;
    }
    setSimilar(await worksRepo.findSimilarTitles(title, workId));
  }

  function patch(changes: Partial<WorkFormValues>) {
    setValues((current) => ({ ...current, ...changes }));
  }

  const selectedType = types?.find((type) => type.id === values.typeId);
  // Cerpen dan artikel tidak punya progres yang berarti; seluruh bloknya
  // disembunyikan, bukan dibiarkan kosong.
  const tracksProgress = selectedType?.tracksProgress !== false;

  function handleTypeChange(typeId: string | null) {
    const type = types?.find((item) => item.id === typeId);
    patch({
      typeId,
      // Satuan mengikuti tipe yang dipilih — manga chapter, novel halaman.
      progressUnit: type?.defaultProgressUnit ?? values.progressUnit,
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!values.title.trim()) {
      setTitleError(t('form.titleRequired'));
      return;
    }

    setSaving(true);
    try {
      await onSubmit(values, cover);
      // Dibuang hanya setelah penyimpanan benar-benar berhasil. Membuangnya
      // lebih awal berarti kegagalan simpan meninggalkan pengguna tanpa isian
      // maupun draf.
      if (isNew) await draftStore.clear();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
      {pendingDraft && (
        <div className="rounded-xl border border-brand bg-elevated p-3">
          <p className="text-sm text-ink">{t('form.draftFound')}</p>
          <p className="mt-1 text-xs text-muted">
            {pendingDraft.title.trim() || t('form.draftUntitled')}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setValues(pendingDraft);
                setPendingDraft(null);
              }}
            >
              {t('action.restore')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void draftStore.clear();
                setPendingDraft(null);
              }}
            >
              {t('action.discard')}
            </Button>
          </div>
        </div>
      )}

      <TextField
        id="judul"
        label={t('form.titleOriginal')}
        placeholder={t('form.titlePlaceholder')}
        value={values.title}
        onChange={(event) => {
          patch({ title: event.target.value });
          setTitleError(null);
          // Peringatan lama dibuang begitu judulnya diubah; membiarkannya
          // membuat pesan itu merujuk judul yang sudah tidak diketik lagi.
          if (similar.length) setSimilar([]);
        }}
        onBlur={() => void checkSimilarTitles()}
        error={titleError}
        autoFocus
      />

      {/* Peringatan, bukan larangan: satu karya bisa punya versi manga dan
          versi novel, dan keduanya berhak dicatat terpisah. Tidak ada yang
          diblokir — tombol simpan tetap bekerja seperti biasa. */}
      {similar.length > 0 && (
        <div className="-mt-2 rounded-xl border border-warning bg-elevated p-3">
          <p className="text-sm text-ink">{t('form.similarTitle')}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {similar.map((work) => {
              const type = types?.find((item) => item.id === work.typeId);
              return (
                <li key={work.id} className="text-sm">
                  <Link
                    to={`/karya/${work.id}`}
                    className="text-brand underline underline-offset-2"
                  >
                    {work.title}
                  </Link>
                  {/* Tipe disebut karena persis itu yang membedakan versi
                      manga dari versi novel — informasi yang dibutuhkan
                      untuk memutuskan lanjut atau tidak. */}
                  <span className="text-muted">
                    {' · '}
                    {type ? type.name : t('works.filterNoType')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <TextField
        id="judul-alt"
        label={t('form.altTitle')}
        placeholder={t('form.altTitlePlaceholder')}
        value={values.altTitle}
        onChange={(event) => patch({ altTitle: event.target.value })}
      />

      <TextField
        id="penulis"
        label={t('form.author')}
        placeholder={t('form.authorPlaceholder')}
        value={values.author}
        onChange={(event) => patch({ author: event.target.value })}
      />

      <TextField
        id="tautan"
        label={t('form.sourceUrl')}
        type="url"
        inputMode="url"
        placeholder="https://…"
        value={values.sourceUrl}
        onChange={(event) => patch({ sourceUrl: event.target.value })}
      />

      <Section title={t('form.section.classification')}>
        <div className="flex gap-3">
          <Select
            id="tipe"
            label={t('form.type')}
            value={values.typeId ?? ''}
            onChange={(event) => handleTypeChange(event.target.value || null)}
          >
            <option value="">{t('works.filterNoType')}</option>
            {types?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>

          <Select
            id="status-terbit"
            label={t('form.pubStatus')}
            value={values.pubStatusId ?? ''}
            onChange={(event) => patch({ pubStatusId: event.target.value || null })}
          >
            <option value="">{t('common.notSet')}</option>
            {statuses?.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-muted">{t('form.ageRating')}</span>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={values.ageRating === null}
              onClick={() => patch({ ageRating: null })}
            >
              {t('common.notSet')}
            </Chip>
            {AGE_RATINGS.map((rating) => (
              <Chip
                key={rating}
                active={values.ageRating === rating}
                onClick={() => patch({ ageRating: rating })}
              >
                {t(AGE_RATING_KEY[rating])}
              </Chip>
            ))}
          </div>
        </div>

        <TaxonomyPicker
          kind="genre"
          value={values.genreIds}
          onChange={(genreIds) => patch({ genreIds })}
        />

        <TaxonomyPicker
          kind="theme"
          value={values.themeIds}
          onChange={(themeIds) => patch({ themeIds })}
        />
      </Section>

      {tracksProgress && (
        <Section title={t('form.section.progress')}>
          <div className="flex gap-3">
            <Select
              id="satuan"
              label={t('form.unit')}
              value={values.progressUnit}
              onChange={(event) =>
                patch({ progressUnit: event.target.value as ProgressUnit })
              }
            >
              {PROGRESS_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {t(PROGRESS_UNIT_KEY[unit])}
                </option>
              ))}
            </Select>

            <TextField
              id="progres-kini"
              label={t('form.progressCurrent')}
              type="number"
              inputMode="numeric"
              min={0}
              value={values.progressCurrent}
              onChange={(event) => patch({ progressCurrent: event.target.value })}
            />

            <TextField
              id="progres-total"
              label={t('form.progressTotal')}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="?"
              value={values.progressTotal}
              onChange={(event) => patch({ progressTotal: event.target.value })}
            />
          </div>
          <p className="-mt-2 text-xs text-muted">
            {t('form.progressHint')}
          </p>
        </Section>
      )}

      <Section title={t('form.section.cover')}>
        <CoverPicker existingThumb={existingCoverThumb} value={cover} onChange={setCover} />
      </Section>

      <Section title={t('form.section.notes')}>
        <Select
          id="skor"
          label={t('form.rating')}
          value={values.personalRating}
          onChange={(event) => patch({ personalRating: event.target.value })}
        >
          <option value="">{t('form.ratingNone')}</option>
          {Array.from({ length: 10 }, (_, index) => 10 - index).map((score) => (
            <option key={score} value={String(score)}>
              {score}
            </option>
          ))}
        </Select>

        <Textarea
          id="sinopsis"
          label={t('form.synopsis')}
          placeholder={t('form.synopsisPlaceholder')}
          value={values.synopsis}
          onChange={(event) => patch({ synopsis: event.target.value })}
        />

        <Textarea
          id="catatan"
          label={t('form.notes')}
          placeholder={t('form.optional')}
          value={values.notes}
          onChange={(event) => patch({ notes: event.target.value })}
        />
      </Section>

      <div className="flex gap-2 border-t border-border pt-5">
        <Button variant="ghost" onClick={onCancel} className="flex-1">
          {t('action.cancel')}
        </Button>
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? t('common.saving') : submitLabel}
        </Button>
      </div>
    </form>
  );
}
