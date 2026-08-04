import { create } from 'zustand';
import type { ReadingStatus, SearchField, WorkSort } from '../db/models';
import type { FilterState } from '../components/ui/FilterChip';

interface UiState {
  query: string;
  /** Cakupan pencarian. Bawaannya menyeluruh, sama seperti sebelumnya. */
  searchField: SearchField;
  /**
   * Tri-state, mengikuti semantik `WorkFilters`: `undefined` = semua,
   * `null` = hanya yang belum diisi, string = nilai tertentu.
   */
  typeId: string | null | undefined;
  pubStatusId: string | null | undefined;
  themeIds: string[];
  genreIds: string[];
  excludeThemeIds: string[];
  excludeGenreIds: string[];
  readingStatus: ReadingStatus | null;
  favoritesOnly: boolean;
  sort: WorkSort;

  setQuery: (query: string) => void;
  setSearchField: (field: SearchField) => void;
  setTypeId: (typeId: string | null | undefined) => void;
  setPubStatusId: (pubStatusId: string | null | undefined) => void;
  cycleTheme: (id: string) => void;
  cycleGenre: (id: string) => void;
  themeState: (id: string) => FilterState;
  genreState: (id: string) => FilterState;
  setReadingStatus: (status: ReadingStatus | null) => void;
  toggleFavoritesOnly: () => void;
  setSort: (sort: WorkSort) => void;
  resetFilters: () => void;
  activeFilterCount: () => number;
}

const without = (list: string[], id: string) => list.filter((item) => item !== id);

/** netral → termasuk → dikecualikan → netral */
function cycle(included: string[], excluded: string[], id: string) {
  if (included.includes(id)) {
    return { included: without(included, id), excluded: [...excluded, id] };
  }
  if (excluded.includes(id)) {
    return { included, excluded: without(excluded, id) };
  }
  return { included: [...included, id], excluded };
}

function stateOf(included: string[], excluded: string[], id: string): FilterState {
  if (included.includes(id)) return 'include';
  if (excluded.includes(id)) return 'exclude';
  return 'off';
}

/**
 * Hanya state UI. Data karya tidak disalin ke sini — `useLiveQuery` dari Dexie
 * sudah membuat komponen ikut ter-render saat isi database berubah, jadi
 * menyalinnya hanya menimbulkan kebutuhan sinkronisasi manual yang rawan bug.
 */
export const useUiStore = create<UiState>((set, get) => ({
  query: '',
  searchField: 'all',
  typeId: undefined,
  pubStatusId: undefined,
  themeIds: [],
  genreIds: [],
  excludeThemeIds: [],
  excludeGenreIds: [],
  readingStatus: null,
  favoritesOnly: false,
  // Untuk catatan bacaan, "apa yang terakhir kubaca" jauh lebih sering dicari
  // daripada "apa yang terakhir kutambahkan".
  sort: 'lastRead',

  setQuery: (query) => set({ query }),
  setSearchField: (searchField) => set({ searchField }),
  setTypeId: (typeId) => set({ typeId }),
  setPubStatusId: (pubStatusId) => set({ pubStatusId }),

  cycleTheme: (id) =>
    set((s) => {
      const next = cycle(s.themeIds, s.excludeThemeIds, id);
      return { themeIds: next.included, excludeThemeIds: next.excluded };
    }),

  cycleGenre: (id) =>
    set((s) => {
      const next = cycle(s.genreIds, s.excludeGenreIds, id);
      return { genreIds: next.included, excludeGenreIds: next.excluded };
    }),

  themeState: (id) => stateOf(get().themeIds, get().excludeThemeIds, id),
  genreState: (id) => stateOf(get().genreIds, get().excludeGenreIds, id),

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
      excludeThemeIds: [],
      excludeGenreIds: [],
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
      s.excludeThemeIds.length +
      s.excludeGenreIds.length +
      (s.readingStatus ? 1 : 0) +
      (s.favoritesOnly ? 1 : 0) +
      (s.sort === 'lastRead' ? 0 : 1)
    );
  },
}));
