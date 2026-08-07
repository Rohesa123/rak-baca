import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Check, Plus, Star } from 'lucide-react';
import type { Taxonomy, Work } from '../../db/models';
import { isProgressAtEnd, readingStatus, worksRepo } from '../../db/works.repo';
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

  const [editingProgress, setEditingProgress] = useState(false);
  // Escape membatalkan, tetapi blur tetap menyusul sesudahnya. Penanda ini yang
  // membedakan "batal" dari "selesai mengetik" di dalam satu handler blur.
  const cancelled = useRef(false);

  const progressText = formatProgress(
    t(PROGRESS_UNIT_SHORT_KEY[work.progressUnit]),
    work.progressCurrent,
    work.progressTotal,
  );

  function commitProgress(raw: string) {
    setEditingProgress(false);

    const text = raw.trim();

    // Kolom kosong berarti batal, bukan nol. Ini bukan kasus pinggiran: input
    // `type="number"` mengosongkan `value` sendiri begitu ketikannya tidak sah,
    // dan `Number('')` bernilai **0** — bukan NaN. Tanpa penjagaan ini, salah
    // ketik satu huruf akan menihilkan progres yang susah payah dicatat.
    if (!text) return;

    const value = Number(text);
    if (!Number.isFinite(value)) return;

    // Angka negatif ditolak, bukan dijepit jadi nol. Pada pengetikan langsung
    // nilai negatif selalu salah ketik, dan menjepitnya diam-diam menghapus
    // progres persis seperti kasus di atas.
    if (value < 0) return;

    const next = Math.floor(value);
    // Nilai yang tidak berubah sengaja tidak ditulis: `setProgress` ikut
    // memperbarui `lastReadAt`, dan itu akan mengacak urutan daftar hanya
    // karena pengguna membuka lalu menutup isian tanpa mengubah apa pun.
    if (next === work.progressCurrent) return;

    // Lewat repo yang sama dengan tombol +1, supaya aturan penjepitan hanya
    // ada di satu tempat. Menyalinnya ke sini berarti dua jalur yang bisa
    // berbeda perilaku tanpa ada yang menyadarinya.
    void worksRepo.setProgress(work.id, next);
  }

  function handleProgressKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      cancelled.current = true;
      event.currentTarget.blur();
    }
  }

  function handleProgressBlur(event: FocusEvent<HTMLInputElement>) {
    if (cancelled.current) {
      cancelled.current = false;
      setEditingProgress(false);
      return;
    }
    commitProgress(event.currentTarget.value);
  }

  /**
   * Angka progres bisa diketuk untuk diketik langsung.
   *
   * Tombol `+1` melayani pembaca yang mengejar rilisan chapter demi chapter.
   * Ia tidak melayani orang yang membaca dua puluh chapter sekali duduk, dan
   * membuka form penuh hanya untuk mengubah satu angka juga berlebihan.
   *
   * `pointer-events-auto` diperlukan karena isi kartu dimatikan pointer-nya
   * agar tautan yang membentang di baliknya bisa menerima ketukan.
   */
  const progressSlot = editingProgress ? (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      defaultValue={work.progressCurrent}
      autoFocus
      aria-label={t('card.editProgress', { title: work.title })}
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={handleProgressKey}
      onBlur={handleProgressBlur}
      className="pointer-events-auto relative w-24 self-start rounded-lg border border-brand bg-surface px-2 py-1 text-xs text-ink outline-none"
    />
  ) : (
    <button
      type="button"
      aria-label={t('card.editProgress', { title: work.title })}
      onClick={() => setEditingProgress(true)}
      className="pointer-events-auto relative -mx-1 self-start rounded px-1 py-0.5 text-left text-xs text-muted underline decoration-dotted underline-offset-2 active:bg-border"
    >
      {progressText}
    </button>
  );

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

          {showAltTitle && <p className="truncate text-xs text-muted">{work.altTitle}</p>}
          {work.author && <p className="truncate text-sm text-muted">{work.author}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {type && <StaticChip>{type.name}</StaticChip>}
          {pubStatus && <StaticChip color={pubStatus.color}>{pubStatus.name}</StaticChip>}
          {status && <StaticChip>{t(READING_STATUS_KEY[status])}</StaticChip>}
          {work.personalRating !== null && <StaticChip>★ {work.personalRating}</StaticChip>}
        </div>

        {tracksProgress &&
          (selectable ? <p className="text-xs text-muted">{progressText}</p> : progressSlot)}
      </div>
    </>
  );

  // Dalam mode pilih, seluruh kartu jadi tombol pilih — navigasi ke detail,
  // tombol tambah progres, dan pengubahan angka sengaja dinonaktifkan supaya
  // tidak ada ketukan yang menghasilkan akibat tak terduga.
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

  /*
    Tautannya membentang menutupi seluruh kartu, bukan membungkus isinya.
    Sebelumnya isi kartu berada di dalam <Link>, dan itu menutup kemungkinan
    menaruh kontrol apa pun di dalamnya: <button> di dalam <a> bukan HTML yang
    sah, dan mengetuknya akan ikut membuka halaman detail.

    Isi kartu dimatikan pointer-nya supaya ketukan tembus ke tautan di
    baliknya; kontrol yang memang perlu ditekan menyalakannya kembali sendiri.
  */
  return (
    <div className="relative flex gap-3 rounded-xl border border-border bg-elevated p-3">
      <Link
        to={`/karya/${work.id}`}
        aria-label={t('card.open', { title: work.title })}
        className="absolute inset-0 rounded-xl"
      />

      <div className="pointer-events-none flex min-w-0 flex-1 gap-3">{body}</div>

      {/*
        Inilah aksi yang paling sering dipakai — kalau harus lewat form,
        pencatatan progres berhenti setelah minggu pertama.
      */}
      {tracksProgress && (
        <button
          type="button"
          aria-label={t('card.bumpProgress', { title: work.title })}
          onClick={() => void worksRepo.bumpProgress(work.id)}
          disabled={isProgressAtEnd(work)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl bg-surface text-brand active:bg-border disabled:pointer-events-none disabled:opacity-30"
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
