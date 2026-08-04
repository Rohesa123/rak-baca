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

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted">{label}</span>

      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
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

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('picker.newValue', { kind: label })}
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
