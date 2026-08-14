import { useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Taxonomy, Work } from '../../db/models';
import type { ViewMode } from '../../stores/viewMode.store';
import { WorkCard } from './WorkCard';
import { WorkTile } from './WorkTile';

/**
 * Di bawah ambang ini daftar dirender apa adanya.
 *
 * Virtualisasi memutus perilaku bawaan peramban — pemulihan posisi gulir,
 * pencarian teks lewat Ctrl+F, dan tinggi kartu yang dihitung sendiri. Menukar
 * itu semua demi koleksi berisi lima puluh judul adalah kerugian bersih, jadi
 * jalur lama tetap dipakai sampai jumlahnya benar-benar membebani.
 */
const AMBANG_VIRTUAL = 80;

/**
 * Jumlah kolom mode Sampul, tetap dan tidak diukur.
 *
 * Wadahnya `max-w-lg`, jadi lebar isinya terkurung antara sekitar 343px di
 * ponsel sempit dan 480px di layar lebar. Tiga kolom nyaman di seluruh rentang
 * itu, sehingga mengukur lebar layar hanya menambah kerumitan tanpa mengubah
 * hasilnya — dan menghindari virtualizer yang harus dihitung ulang tiap kali
 * layar berputar.
 */
const KOLOM_SAMPUL = 3;

/** Perkiraan tinggi sebelum diukur; hanya menentukan scrollbar awal. */
const TINGGI_PERKIRAAN: Record<ViewMode, number> = {
  kartu: 104,
  ringkas: 64,
  sampul: 210,
};

interface WorkListProps {
  works: Work[];
  taxonomyById: Map<string, Taxonomy>;
  selectable: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  mode: ViewMode;
  /** Diisi hanya saat urutan manual aktif. */
  onMove?: (id: string, direction: -1 | 1) => void;
  onMoveToEdge?: (id: string, edge: 'top' | 'bottom') => void;
}

interface Anchor {
  scroller: HTMLElement;
  /** Jarak daftar dari puncak isi wadah gulir. */
  offset: number;
}

export function WorkList({
  works,
  taxonomyById,
  selectable,
  selectedIds,
  onToggleSelect,
  mode,
  onMove,
  onMoveToEdge,
}: WorkListProps) {
  /**
   * Callback ref, bukan `useRef` + effect.
   *
   * `useVirtualizer` memanggil `getScrollElement` saat render, dan pada render
   * pertama sebuah `useRef` masih `null` — pendengar gulir tidak pernah
   * terpasang dan daftarnya membeku pada sepuluh kartu pertama. Menyimpannya
   * sebagai state membuat komponen dirender ulang begitu simpulnya menempel,
   * dan saat itulah virtualizer mendapat elemen yang sesungguhnya.
   */
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      setAnchor(null);
      return;
    }

    const scroller = node.closest('main');
    if (!scroller) return;

    // Dihitung dari rect, bukan `offsetTop`: induk berposisi terdekat belum
    // tentu wadah gulirnya, sehingga `offsetTop` bisa mengukur dari elemen yang
    // sama sekali lain. Penambahan `scrollTop` membuat angkanya tidak
    // bergantung pada posisi gulir saat diukur.
    const offset =
      node.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop;

    setAnchor({ scroller, offset });
  }, []);

  const grid = mode === 'sampul';

  // Mode Sampul memvirtualisasi **baris berisi tiga petak**, bukan petak
  // satuan. Ini perbedaan yang menentukan: virtualizer hanya mengenal satu
  // sumbu, jadi grid harus dibungkus jadi baris lebih dulu.
  const barisan: Work[][] = grid
    ? Array.from({ length: Math.ceil(works.length / KOLOM_SAMPUL) }, (_, i) =>
        works.slice(i * KOLOM_SAMPUL, i * KOLOM_SAMPUL + KOLOM_SAMPUL),
      )
    : [];

  const jumlahUnit = grid ? barisan.length : works.length;
  const virtual = jumlahUnit > (grid ? AMBANG_VIRTUAL / KOLOM_SAMPUL : AMBANG_VIRTUAL);

  /*
    ESLint memberi peringatan "Compilation Skipped: Use of incompatible library"
    di sini, dan itu memang benar: `useVirtualizer` mengembalikan fungsi yang
    tidak bisa dimemoisasi tanpa membuat tampilan basi, sehingga React Compiler
    melewatkan seluruh komponen ini.

    Dibiarkan dengan sadar. Komponen ini memang harus dirender ulang pada tiap
    perubahan posisi gulir — memoisasi justru lawan dari yang dibutuhkannya.
    Peringatan ini melekat pada pustakanya, bukan pada kode di bawah.
  */
  const virtualizer = useVirtualizer({
    count: virtual ? jumlahUnit : 0,
    getScrollElement: () => anchor?.scroller ?? null,
    estimateSize: () => TINGGI_PERKIRAAN[mode],
    // Tinggi tidak seragam — judul yang membungkus dua baris, chip yang
    // melipat. Diukur sungguhan, bukan ditebak.
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: grid ? 3 : 6,
    // Tanpa ini setiap baris meleset sejauh tinggi header dan kotak pencarian
    // yang berada di atas daftar.
    scrollMargin: anchor?.offset ?? 0,
    getItemKey: (index) => (grid ? barisan[index][0].id : works[index].id),
  });

  const satuan = (work: Work, index: number) =>
    grid ? (
      <WorkTile
        work={work}
        taxonomyById={taxonomyById}
        selectable={selectable}
        selected={selectedIds.has(work.id)}
        onToggleSelect={() => onToggleSelect(work.id)}
      />
    ) : (
      <WorkCard
        work={work}
        taxonomyById={taxonomyById}
        selectable={selectable}
        selected={selectedIds.has(work.id)}
        onToggleSelect={() => onToggleSelect(work.id)}
        compact={mode === 'ringkas'}
        // Panah disembunyikan selama mode pilih: dua aksi berbeda pada satu kartu
        // menuntut pengguna menebak mana yang sedang berlaku.
        onMove={onMove && !selectable ? (dir) => onMove(work.id, dir) : undefined}
        onMoveToEdge={
          onMoveToEdge && !selectable ? (edge) => onMoveToEdge(work.id, edge) : undefined
        }
        canMoveUp={index > 0}
        canMoveDown={index < works.length - 1}
      />
    );

  /** Satu baris grid; dipakai sama persis oleh jalur biasa maupun tervirtualisasi. */
  const barisGrid = (baris: Work[], indexBaris: number) => (
    <div className="grid grid-cols-3 gap-2">
      {baris.map((work, kolom) => (
        <div key={work.id}>{satuan(work, indexBaris * KOLOM_SAMPUL + kolom)}</div>
      ))}
    </div>
  );

  if (!virtual) {
    return (
      <div ref={attach} className={`mt-4 flex flex-col ${grid ? 'gap-2' : 'gap-2'}`}>
        {grid
          ? barisan.map((baris, i) => <div key={baris[0].id}>{barisGrid(baris, i)}</div>)
          : works.map((work, index) => <div key={work.id}>{satuan(work, index)}</div>)}
      </div>
    );
  }

  return (
    <div
      ref={attach}
      className="relative mt-4"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          ref={virtualizer.measureElement}
          data-index={item.index}
          className="absolute inset-x-0 top-0 pb-2"
          style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
        >
          {grid ? barisGrid(barisan[item.index], item.index) : satuan(works[item.index], item.index)}
        </div>
      ))}
    </div>
  );
}
