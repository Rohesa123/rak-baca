import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { worksRepo } from '../../db/works.repo';
import { taxonomiesRepo } from '../../db/taxonomies.repo';
import type { WorkSort } from '../../db/models';
import {
  READING_STATUSES,
  READING_STATUS_KEY,
  SEARCH_FIELDS,
  SEARCH_FIELD_LABEL,
  SEARCH_FIELD_PLACEHOLDER,
  SORTS,
  SORT_KEY,
  TAXONOMY_KIND_KEY,
} from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { useUiStore } from '../../stores/ui.store';
import { WorkCard } from '../../components/work/WorkCard';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { FilterChip } from '../../components/ui/FilterChip';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Select } from '../../components/ui/Select';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

export function WorksPage() {
  const query = useUiStore((s) => s.query);
  const searchField = useUiStore((s) => s.searchField);
  const typeId = useUiStore((s) => s.typeId);
  const pubStatusId = useUiStore((s) => s.pubStatusId);
  const themeIds = useUiStore((s) => s.themeIds);
  const genreIds = useUiStore((s) => s.genreIds);
  const excludeThemeIds = useUiStore((s) => s.excludeThemeIds);
  const excludeGenreIds = useUiStore((s) => s.excludeGenreIds);
  const readingStatus = useUiStore((s) => s.readingStatus);
  const favoritesOnly = useUiStore((s) => s.favoritesOnly);
  const sort = useUiStore((s) => s.sort);

  const setQuery = useUiStore((s) => s.setQuery);
  const setSearchField = useUiStore((s) => s.setSearchField);
  const setTypeId = useUiStore((s) => s.setTypeId);
  const setPubStatusId = useUiStore((s) => s.setPubStatusId);
  const cycleTheme = useUiStore((s) => s.cycleTheme);
  const cycleGenre = useUiStore((s) => s.cycleGenre);
  const themeState = useUiStore((s) => s.themeState);
  const genreState = useUiStore((s) => s.genreState);
  const setReadingStatus = useUiStore((s) => s.setReadingStatus);
  const toggleFavoritesOnly = useUiStore((s) => s.toggleFavoritesOnly);
  const setSort = useUiStore((s) => s.setSort);
  const resetFilters = useUiStore((s) => s.resetFilters);
  const activeFilterCount = useUiStore((s) => s.activeFilterCount());

  const t = useT();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function deleteSelected() {
    const ids = [...selectedIds];
    // Berurutan, bukan Promise.all: tiap penghapusan membuka transaksi Dexie
    // sendiri yang menyentuh tiga tabel sekaligus.
    for (const id of ids) await worksRepo.remove(id);

    setConfirmDelete(false);
    setExportMessage(t('works.deleted', { count: ids.length }));
    leaveSelectMode();
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function leaveSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function exportSelected() {
    setExportBusy(true);
    setExportMessage(null);

    try {
      // Diimpor dinamis — modul backup membawa fflate dan dua plugin Capacitor
      // yang tidak perlu ikut bundel daftar karya.
      const { buildExport, deliverExport } = await import('../../lib/backup');
      const result = await buildExport({
        includeImages: true,
        workIds: [...selectedIds],
      });
      await deliverExport(result);
      setExportMessage(t('works.exported', { count: result.workCount }));
      leaveSelectMode();
    } catch {
      setExportMessage(t('works.exportFailed'));
    } finally {
      setExportBusy(false);
    }
  }

  const works = useLiveQuery(
    () =>
      worksRepo.list({
        query,
        searchField,
        typeId,
        pubStatusId,
        themeIds,
        genreIds,
        excludeThemeIds,
        excludeGenreIds,
        readingStatus: readingStatus ?? undefined,
        favoritesOnly,
        sort,
      }),
    [
      query,
      searchField,
      typeId,
      pubStatusId,
      themeIds,
      genreIds,
      excludeThemeIds,
      excludeGenreIds,
      readingStatus,
      favoritesOnly,
      sort,
    ],
  );

  const totalCount = useLiveQuery(() => worksRepo.count(), []);
  const taxonomies = useLiveQuery(() => taxonomiesRepo.listAll(), []);

  const taxonomyById = useMemo(
    () => new Map((taxonomies ?? []).map((row) => [row.id, row])),
    [taxonomies],
  );

  const byKind = (kind: string) => (taxonomies ?? []).filter((row) => row.kind === kind);

  const isFiltering = activeFilterCount > 0 || query.trim() !== '';

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-28">
      <PageHeader
        title={t('works.title')}
        subtitle={
          totalCount === undefined
            ? t('common.loading')
            : totalCount === 0
              ? t('works.empty')
              : t('works.count', { count: totalCount })
        }
        action={<ThemeToggle />}
      />

      {selectMode && (
        <div className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-brand bg-elevated p-3">
          <span className="text-sm text-ink">{t('works.selectedCount', { count: selectedIds.size })}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={leaveSelectMode}>
              {t('action.cancel')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger"
              disabled={selectedIds.size === 0 || exportBusy}
              onClick={() => setConfirmDelete(true)}
            >
              {t('action.delete')}
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0 || exportBusy}
              onClick={() => void exportSelected()}
            >
              {exportBusy ? t('common.processing') : t('action.export')}
            </Button>
          </div>
        </div>
      )}

      {/* Jumlahnya disebut eksplisit di judul maupun isi: penghapusan massal
          jauh lebih mahal untuk disesali daripada penghapusan satuan. */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('works.deleteSelected', { count: selectedIds.size })}
        description={t('works.deleteSelectedBody', { count: selectedIds.size })}
        onConfirm={() => void deleteSelected()}
      />

      {exportMessage && !selectMode && (
        <p className="mt-3 text-sm text-muted">{exportMessage}</p>
      )}

      {/* Pencarian dan filter disembunyikan selama memilih: mengubah filter
          akan membuat sebagian pilihan menghilang dari layar padahal tetap
          terhitung, dan itu membingungkan. */}
      {!selectMode && (
      <div className="mt-5 flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(SEARCH_FIELD_PLACEHOLDER[searchField])}
          aria-label={t('works.searchLabel')}
          className="h-11 w-full rounded-xl border border-border bg-elevated px-3 text-base text-ink outline-none placeholder:text-muted focus:border-brand"
        />

        {/* Hanya muncul saat ada yang diketik. Menampilkannya terus-menerus
            membebani layar dengan kontrol yang tidak berarti apa-apa selama
            kotak pencariannya masih kosong. */}
        {query.trim().length > 0 && (
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1">
            <span className="shrink-0 text-xs text-muted">{t('works.searchIn')}</span>
            {SEARCH_FIELDS.map((field) => (
              <Chip
                key={field}
                active={searchField === field}
                onClick={() => setSearchField(field)}
              >
                {t(SEARCH_FIELD_LABEL[field])}
              </Chip>
            ))}
          </div>
        )}

        {/* Status baca paling sering dipakai, jadi dibiarkan terlihat. */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={readingStatus === null} onClick={() => setReadingStatus(null)}>
            {t('common.all')}
          </Chip>
          {READING_STATUSES.map((status) => (
            <Chip
              key={status}
              active={readingStatus === status}
              onClick={() => setReadingStatus(status)}
            >
              {t(READING_STATUS_KEY[status])}
            </Chip>
          ))}
          <Chip active={favoritesOnly} onClick={toggleFavoritesOnly}>
            {t('works.favoritesFilter')}
          </Chip>
        </div>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            {activeFilterCount > 0
              ? t('works.filterWithCount', { count: activeFilterCount })
              : t('works.filter')}
          </Button>

          <div className="flex gap-1">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                {t('action.reset')}
              </Button>
            )}
            {(works?.length ?? 0) > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)}>
                {t('action.select')}
              </Button>
            )}
          </div>
        </div>

        {filtersOpen && (
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-elevated p-3">
            <div className="flex gap-3">
              <Select
                id="filter-tipe"
                label={t('works.filterType')}
                value={typeId === undefined ? 'ALL' : (typeId ?? 'NONE')}
                onChange={(event) => {
                  const next = event.target.value;
                  setTypeId(next === 'ALL' ? undefined : next === 'NONE' ? null : next);
                }}
              >
                <option value="ALL">{t('common.all')}</option>
                <option value="NONE">{t('works.filterNoType')}</option>
                {byKind('type').map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </Select>

              <Select
                id="filter-status-terbit"
                label={t('works.filterPubStatus')}
                value={pubStatusId === undefined ? 'ALL' : (pubStatusId ?? 'NONE')}
                onChange={(event) => {
                  const next = event.target.value;
                  setPubStatusId(
                    next === 'ALL' ? undefined : next === 'NONE' ? null : next,
                  );
                }}
              >
                <option value="ALL">{t('common.all')}</option>
                <option value="NONE">{t('common.notSet')}</option>
                {byKind('pubstatus').map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </Select>
            </div>

            <Select
              id="filter-urutan"
              label={t('works.filterSort')}
              value={sort}
              onChange={(event) => setSort(event.target.value as WorkSort)}
            >
              {SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(SORT_KEY[value])}
                </option>
              ))}
            </Select>

            <p className="-mb-1 text-xs text-muted">{t('works.filterCycleHint')}</p>

            {(['genre', 'theme'] as const).map((kind) => {
              const rows = byKind(kind);
              if (rows.length === 0) return null;

              const included = kind === 'genre' ? genreIds : themeIds;
              const cycleValue = kind === 'genre' ? cycleGenre : cycleTheme;
              const stateOf = kind === 'genre' ? genreState : themeState;

              return (
                <div key={kind} className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-muted">
                    {t(TAXONOMY_KIND_KEY[kind])}
                    {included.length > 1 && ` ${t('works.filterMustHaveAll')}`}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {rows.map((row) => (
                      <FilterChip
                        key={row.id}
                        state={stateOf(row.id)}
                        onCycle={() => cycleValue(row.id)}
                      >
                        {row.name}
                      </FilterChip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      <div className="mt-5">
        {works === undefined ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : works.length === 0 ? (
          isFiltering ? (
            <EmptyState
              title={t('works.noMatch')}
              description={t('works.noMatchHint')}
            />
          ) : (
            <EmptyState
              title={t('works.empty')}
              description={t('works.emptyHint')}
            />
          )
        ) : (
          <ul className="flex flex-col gap-2">
            {works.map((work) => (
              <li key={work.id}>
                <WorkCard
                  work={work}
                  taxonomyById={taxonomyById}
                  selectable={selectMode}
                  selected={selectedIds.has(work.id)}
                  onToggleSelect={() => toggleSelected(work.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {!selectMode && (
      <Link
        to="/karya/baru"
        aria-label={t('works.addAria')}
        className="fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg active:opacity-80"
        // Diangkat di atas bottom nav plus gesture bar Android.
        style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
      >
        <Plus size={26} aria-hidden="true" />
      </Link>
      )}
    </div>
  );
}
