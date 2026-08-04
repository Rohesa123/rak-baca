import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { taxonomiesRepo } from '../../db/taxonomies.repo';
import type { TaxonomyKind } from '../../db/models';
import { TAXONOMY_KIND_KEY } from '../../lib/labels';
import { useT } from '../../i18n/useT';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';

interface TaxonomyPickerProps {
  kind: TaxonomyKind;
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Pemilih banyak nilai untuk tema dan genre, dengan pembuatan nilai baru inline. */
export function TaxonomyPicker({ kind, value, onChange }: TaxonomyPickerProps) {
  const t = useT();
  const options = useLiveQuery(() => taxonomiesRepo.listByKind(kind), [kind]);
  const [draft, setDraft] = useState('');

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  }

  async function addFromDraft() {
    const name = draft.trim();
    if (!name) return;

    // findOrCreate, bukan create: mengetik nama yang sudah ada seharusnya
    // memilihnya, bukan memunculkan error duplikat.
    const row = await taxonomiesRepo.findOrCreate(kind, name);
    if (!value.includes(row.id)) onChange([...value, row.id]);
    setDraft('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Tanpa ini, Enter akan men-submit form karya yang membungkusnya.
      event.preventDefault();
      void addFromDraft();
    }
  }

  const label = t(TAXONOMY_KIND_KEY[kind]);

  // Kotak yang sama menyaring dan membuat. Nilai bawaan sudah 20 per sumbu dan
  // pengguna bisa terus menambah; pada angka ratusan, deretan chip mustahil
  // dipindai mata. Menggabungkannya ke satu kotak menghindari dua medan teks
  // berdampingan yang fungsinya nyaris sama — ketik untuk mempersempit, tekan
  // tambah kalau yang dicari memang belum ada.
  const query = draft.trim().toLowerCase();
  const all = options ?? [];

  // Yang sudah dipilih selalu ikut tampil meski tidak cocok dengan kata kunci.
  // Kalau ikut tersembunyi, pengguna kehilangan jejak apa saja yang sudah
  // dipilihnya, dan satu-satunya cara memeriksa adalah mengosongkan pencarian.
  const selected = all.filter((option) => value.includes(option.id));
  const rest = all.filter(
    (option) => !value.includes(option.id) && (!query || option.name.toLowerCase().includes(query)),
  );

  // Tanpa kata kunci, daftar dipangkas supaya form tidak berubah jadi dinding
  // chip. Begitu pengguna mengetik, seluruh yang cocok ditampilkan.
  const LIMIT = 20;
  const hidden = query ? 0 : Math.max(0, rest.length - LIMIT);
  const shown = [...selected, ...(hidden ? rest.slice(0, LIMIT) : rest)];

  const exactExists = all.some((option) => option.name.toLowerCase() === query);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted">{label}</span>

      {shown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shown.map((option) => (
            <Chip
              key={option.id}
              active={value.includes(option.id)}
              onClick={() => toggle(option.id)}
            >
              {option.name}
            </Chip>
          ))}
        </div>
      )}

      {hidden > 0 && (
        <p className="text-xs text-muted">{t('picker.moreHidden', { count: hidden })}</p>
      )}

      {query && rest.length === 0 && !exactExists && (
        <p className="text-xs text-muted">{t('picker.noMatch', { query: draft.trim() })}</p>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('picker.searchOrAdd', { kind: label.toLowerCase() })}
          className="h-11 w-full min-w-0 rounded-xl border border-border bg-elevated px-3 text-base text-ink outline-none placeholder:text-muted focus:border-brand"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('picker.addValue', { kind: label.toLowerCase() })}
          onClick={() => void addFromDraft()}
          disabled={!draft.trim()}
        >
          <Plus size={20} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
