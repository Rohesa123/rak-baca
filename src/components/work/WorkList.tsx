import { useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Taxonomy, Work } from '../../db/models';
import { WorkCard } from './WorkCard';

/**
 * Di bawah ambang ini daftar dirender apa adanya.
 *
 * Virtualisasi memutus perilaku bawaan peramban — pemulihan posisi gulir,
 * pencarian teks lewat Ctrl+F, dan tinggi kartu yang dihitung sendiri. Menukar
 * itu semua demi koleksi berisi lima puluh judul adalah kerugian bersih, jadi
 * jalur lama tetap dipakai sampai jumlahnya benar-benar membebani.
 */
const AMBANG_VIRTUAL = 80;

/** Perkiraan tinggi kartu sebelum diukur; hanya menentukan scrollbar awal. */
const TINGGI_PERKIRAAN = 104;

interface WorkListProps {
  works: Work[];
  taxonomyById: Map<string, Taxonomy>;
  selectable: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  /** Diisi hanya saat urutan manual aktif. */
  onMove?: (id: string, direction: -1 | 1) => void;
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
  onMove,
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

  const virtual = works.length > AMBANG_VIRTUAL;

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
    count: virtual ? works.length : 0,
    getScrollElement: () => anchor?.scroller ?? null,
    estimateSize: () => TINGGI_PERKIRAAN,
    // Tinggi kartu tidak seragam — judul alternatif, penulis, dan chip yang
    // membungkus membuatnya berbeda-beda. Diukur sungguhan, bukan ditebak.
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 6,
    // Tanpa ini setiap baris meleset sejauh tinggi header dan kotak pencarian
    // yang berada di atas daftar.
    scrollMargin: anchor?.offset ?? 0,
    getItemKey: (index) => works[index].id,
  });

  const kartu = (work: Work, index: number) => (
    <WorkCard
      work={work}
      taxonomyById={taxonomyById}
      selectable={selectable}
      selected={selectedIds.has(work.id)}
      onToggleSelect={() => onToggleSelect(work.id)}
      // Panah disembunyikan selama mode pilih: dua aksi berbeda pada satu kartu
      // menuntut pengguna menebak mana yang sedang berlaku.
      onMove={onMove && !selectable ? (dir) => onMove(work.id, dir) : undefined}
      canMoveUp={index > 0}
      canMoveDown={index < works.length - 1}
    />
  );

  if (!virtual) {
    return (
      <div ref={attach} className="mt-4 flex flex-col gap-2">
        {works.map((work, index) => (
          <div key={work.id}>{kartu(work, index)}</div>
        ))}
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
          {kartu(works[item.index], item.index)}
        </div>
      ))}
    </div>
  );
}
