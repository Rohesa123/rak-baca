import { create } from 'zustand';
import type { ReadingStatus, WorkSort } from '../db/models';

interface UiState {
  query: string;
  /**
   * Tri-state, mengikuti semantik `WorkFilters`: `undefined` = semua,
   * `null` = hanya yang belum diisi, string = nilai tertentu.
   */
  typeId: string | null | undefined;
  pubStatusId: string | null | undefined;
  themeIds: string[];
  genreIds: string[];
  readingStatus: ReadingStatus | null;
  favoritesOnly: boolean;
  sort: WorkSort;

  setQuery: (query: string) => void;
  setTypeId: (typeId: string | null | undefined) => void;
  setPubStatusId: (pubStatusId: string | null | undefined) => void;
  toggleTheme: (id: string) => void;
  toggleGenre: (id: string) => void;
  setReadingStatus: (status: ReadingStatus | null) => void;
  toggleFavoritesOnly: () => void;
  setSort: (sort: WorkSort) => void;
  resetFilters: () => void;
  activeFilterCount: () => number;
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

/**
 * Hanya state UI. Data karya tidak disalin ke sini — `useLiveQuery` dari Dexie
 * sudah membuat komponen ikut ter-render saat isi database berubah, jadi
 * menyalinnya hanya menimbulkan kebutuhan sinkronisasi manual yang rawan bug.
 */
export const useUiStore = create<UiState>((set, get) => ({
  query: '',
  typeId: undefined,
  pubStatusId: undefined,
  themeIds: [],
  genreIds: [],
  readingStatus: null,
  favoritesOnly: false,
  // Untuk catatan bacaan, "apa yang terakhir kubaca" jauh lebih sering dicari
  // daripada "apa yang terakhir kutambahkan".
  sort: 'lastRead',

  setQuery: (query) => set({ query }),
  setTypeId: (typeId) => set({ typeId }),
  setPubStatusId: (pubStatusId) => set({ pubStatusId }),
  toggleTheme: (id) => set((s) => ({ themeIds: toggle(s.themeIds, id) })),
  toggleGenre: (id) => set((s) => ({ genreIds: toggle(s.genreIds, id) })),
  setReadingStatus: (readingStatus) => set({ readingStatus }),
  toggleFavoritesOnly: () => set((s) => ({ favoritesOnly: !s.favoritesOnly })),
  setSort: (sort) => set({ sort }),

  // Sengaja tidak mengosongkan `query`: tombol reset ada di panel filter,
  // sementara kolom pencarian berdiri sendiri di atasnya.
  resetFilters: () =>
    set({
      typeId: undefined,
      pubStatusId: undefined,
      themeIds: [],
      genreIds: [],
      readingStatus: null,
      favoritesOnly: false,
      sort: 'lastRead',
    }),

  activeFilterCount: () => {
    const s = get();
    return (
      (s.typeId !== undefined ? 1 : 0) +
      (s.pubStatusId !== undefined ? 1 : 0) +
      s.themeIds.length +
      s.genreIds.length +
      (s.readingStatus ? 1 : 0) +
      (s.favoritesOnly ? 1 : 0) +
      (s.sort === 'lastRead' ? 0 : 1)
    );
  },
}));
