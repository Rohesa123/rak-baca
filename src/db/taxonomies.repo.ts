import { db } from './database';
import type { ProgressUnit, Taxonomy, TaxonomyKind } from './models';
import { newId } from '../lib/id';

export interface TaxonomyWithCount extends Taxonomy {
  workCount: number;
}

function listByKind(kind: TaxonomyKind): Promise<Taxonomy[]> {
  return db.taxonomies.where('kind').equals(kind).sortBy('name');
}

function listAll(): Promise<Taxonomy[]> {
  return db.taxonomies.orderBy('name').toArray();
}

/**
 * Satu kali baca tabel works untuk menghitung seluruh nilai sekaligus, bukan
 * N query terpisah. Aman karena tabel works hanya berisi metadata — blob
 * gambar ada di tabel lain.
 */
async function listWithCounts(kind: TaxonomyKind): Promise<TaxonomyWithCount[]> {
  const [rows, works] = await Promise.all([listByKind(kind), db.works.toArray()]);

  const counts = new Map<string, number>();
  const bump = (id: string | null | undefined) => {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  };

  for (const work of works) {
    switch (kind) {
      case 'type':
        bump(work.typeId);
        break;
      case 'pubstatus':
        bump(work.pubStatusId);
        break;
      case 'theme':
        work.themeIds.forEach(bump);
        break;
      case 'genre':
        work.genreIds.forEach(bump);
        break;
    }
  }

  return rows.map((row) => ({ ...row, workCount: counts.get(row.id) ?? 0 }));
}

interface CreateOptions {
  color?: string;
  tracksProgress?: boolean;
  defaultProgressUnit?: ProgressUnit;
}

/** Melempar `ConstraintError` kalau pasangan kind+name sudah dipakai. */
async function create(
  kind: TaxonomyKind,
  name: string,
  options: CreateOptions = {},
): Promise<Taxonomy> {
  const row: Taxonomy = {
    id: newId(),
    kind,
    name: name.trim(),
    createdAt: Date.now(),
    ...options,
  };

  // Tipe baru selalu punya setelan progres, supaya form tidak perlu
  // menebak-nebak saat nilainya belum pernah diisi.
  if (kind === 'type') {
    row.tracksProgress = options.tracksProgress ?? true;
    row.defaultProgressUnit = options.defaultProgressUnit ?? 'chapter';
  }

  await db.taxonomies.add(row);
  return row;
}

/**
 * Dipakai pemilih tema dan genre yang boleh membuat nilai baru sambil
 * mengetik: pakai yang sudah ada kalau namanya cocok, kalau belum ada baru
 * dibuat. Mencegah ConstraintError dari percobaan membuat duplikat.
 */
async function findOrCreate(kind: TaxonomyKind, name: string): Promise<Taxonomy> {
  const trimmed = name.trim();
  const existing = await db.taxonomies.where({ kind, name: trimmed }).first();
  return existing ?? (await create(kind, trimmed));
}

/**
 * Karya yang memakainya tidak ikut terhapus — rujukannya dilepas. Cara
 * melepasnya berbeda per sumbu, tapi semuanya dalam satu transaksi supaya
 * tidak mungkin setengah jadi.
 */
async function remove(id: string): Promise<void> {
  await db.transaction('rw', db.taxonomies, db.works, async () => {
    const row = await db.taxonomies.get(id);
    if (!row) return;

    switch (row.kind) {
      case 'type':
        await db.works.where('typeId').equals(id).modify({ typeId: null });
        break;
      case 'pubstatus':
        await db.works.where('pubStatusId').equals(id).modify({ pubStatusId: null });
        break;
      case 'theme':
        await db.works
          .where('themeIds')
          .equals(id)
          .modify((work) => {
            work.themeIds = work.themeIds.filter((themeId) => themeId !== id);
          });
        break;
      case 'genre':
        await db.works
          .where('genreIds')
          .equals(id)
          .modify((work) => {
            work.genreIds = work.genreIds.filter((genreId) => genreId !== id);
          });
        break;
    }

    await db.taxonomies.delete(id);
  });
}

export const taxonomiesRepo = {
  listByKind,
  listAll,
  listWithCounts,
  create,
  findOrCreate,
  remove,

  get(id: string): Promise<Taxonomy | undefined> {
    return db.taxonomies.get(id);
  },

  async rename(id: string, name: string): Promise<void> {
    await db.taxonomies.update(id, { name: name.trim() });
  },

  async setColor(id: string, color: string): Promise<void> {
    await db.taxonomies.update(id, { color });
  },

  /** Hanya berarti untuk `kind: 'type'`. */
  async setTypeSettings(
    id: string,
    settings: { tracksProgress?: boolean; defaultProgressUnit?: ProgressUnit },
  ): Promise<void> {
    await db.taxonomies.update(id, settings);
  },
};
