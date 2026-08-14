import { useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Check, ChevronDown, ChevronUp, ExternalLink, Plus, Star } from 'lucide-react';
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
  /**
   * Diisi hanya saat urutan manual aktif. Panah menggantikan tombol +1 alih-alih
   * menemaninya: saat sedang menyusun urutan, menambah progres bukan yang
   * dicari, dan tiga tombol berjajar di kartu selebar ponsel jadi terlalu rapat.
   */
  onMove?: (direction: -1 | 1) => void;
  /** Tekan-lama pada panah. Lihat catatan di tombolnya. */
  onMoveToEdge?: (edge: 'top' | 'bottom') => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /**
   * `ringkas` memangkas judul alternatif, penulis, dan chip — menyisakan
   * sampul kecil, judul, dan progres. Kendali yang tersisa hanya `+1` dan
   * tautan sumber; keduanya satu ketukan dan tidak menuntut ruang baca.
   */
  compact?: boolean;
}

export function WorkCard({
  work,
  taxonomyById,
  selectable = false,
  selected = false,
  onToggleSelect,
  onMove,
  onMoveToEdge,
  canMoveUp = false,
  canMoveDown = false,
  compact = false,
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
        className={compact ? 'h-12 w-8' : 'h-20 w-14'}
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

          {!compact && showAltTitle && (
            <p className="truncate text-xs text-muted">{work.altTitle}</p>
          )}
          {!compact && work.author && (
            <p className="truncate text-sm text-muted">{work.author}</p>
          )}
        </div>

        {!compact && (
          <div className="flex flex-wrap items-center gap-1.5">
            {type && <StaticChip>{type.name}</StaticChip>}
            {pubStatus && <StaticChip color={pubStatus.color}>{pubStatus.name}</StaticChip>}
            {status && <StaticChip>{t(READING_STATUS_KEY[status])}</StaticChip>}
            {work.personalRating !== null && <StaticChip>★ {work.personalRating}</StaticChip>}
          </div>
        )}

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
    <div
      className={`relative flex gap-3 rounded-xl border border-border bg-elevated ${
        compact ? 'p-2' : 'p-3'
      }`}
    >
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
      {/*
        Tautan sumber, satu ketukan dari daftar.
        Sebelumnya hanya ada di halaman detail, sehingga "lanjutkan membaca" —
        gerakan yang paling sering dilakukan di aplikasi ini — butuh dua
        ketukan. Muncul hanya kalau tautannya memang terisi: ikon mati yang
        selalu ada lebih membingungkan daripada ikon yang kadang tidak muncul.

        Sengaja <a> tersendiri, bukan di dalam tautan kartu yang membentang:
        <a> di dalam <a> bukan HTML yang sah, dan mengetuknya tidak boleh ikut
        membuka halaman detail.
      */}
      {work.sourceUrl && (
        <a
          href={work.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('card.openSource', { title: work.title })}
          className="relative flex h-11 w-9 shrink-0 items-center justify-center self-center rounded-xl text-muted active:bg-border"
        >
          <ExternalLink size={17} aria-hidden="true" />
        </a>
      )}

      {onMove ? (
        <div className="relative flex shrink-0 flex-col justify-center gap-1">
          <button
            type="button"
            aria-label={t('card.moveUp', { title: work.title })}
            onClick={() => onMove(-1)}
            /*
              Tekan-lama melempar ke ujung. Tidak terlihat dengan sendirinya —
              itu kelemahan nyata dari pilihan ini — jadi penjelasannya
              dititipkan ke petunjuk yang sudah muncul saat urutan manual aktif.
              Menambah tombol ketiga di kartu selebar ponsel dinilai lebih
              merugikan daripada satu kalimat di petunjuk yang sudah dibaca.
            */
            onContextMenu={(event) => {
              // Tekan-lama di Android memunculkan menu konteks lebih dulu.
              event.preventDefault();
              onMoveToEdge?.('top');
            }}
            disabled={!canMoveUp}
            className="flex h-8 w-11 items-center justify-center rounded-lg bg-surface text-brand active:bg-border disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronUp size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('card.moveDown', { title: work.title })}
            onClick={() => onMove(1)}
            onContextMenu={(event) => {
              event.preventDefault();
              onMoveToEdge?.('bottom');
            }}
            disabled={!canMoveDown}
            className="flex h-8 w-11 items-center justify-center rounded-lg bg-surface text-brand active:bg-border disabled:pointer-events-none disabled:opacity-25"
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        tracksProgress && (
          <button
            type="button"
            aria-label={t('card.bumpProgress', { title: work.title })}
            onClick={() => void worksRepo.bumpProgress(work.id)}
            disabled={isProgressAtEnd(work)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl bg-surface text-brand active:bg-border disabled:pointer-events-none disabled:opacity-30"
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        )
      )}
    </div>
  );
}
