import { Share } from '@capacitor/share';
import type { ProgressUnit, Taxonomy, Work } from '../db/models';
import { formatProgress } from './labels';
import { isNative } from './platform';

export interface ShareTextOptions {
  works: Work[];
  taxonomyById: Map<string, Taxonomy>;
  /** Menerjemahkan satuan progres jadi bentuk pendeknya, mis. "Ch." */
  shortUnit: (unit: ProgressUnit) => string;
  heading: string;
}

/**
 * Menyusun daftar bacaan sebagai teks biasa.
 *
 * Teks biasa, bukan Markdown maupun tabel: yang menerimanya adalah WhatsApp,
 * Discord, atau catatan orang lain, dan di sana tanda bintang serta pipa hanya
 * jadi derau.
 *
 * Tautan sumber ikut disertakan justru karena itu bagian yang paling berguna
 * bagi penerimanya — judul tanpa tautan menuntut mereka mencarinya sendiri.
 *
 * Fungsi murni supaya bisa diuji tanpa menyentuh plugin native.
 */
export function formatWorksAsText({
  works,
  taxonomyById,
  shortUnit,
  heading,
}: ShareTextOptions): string {
  const baris = works.map((work, index) => {
    const type = work.typeId ? taxonomyById.get(work.typeId) : undefined;
    const type_ = type ? ` (${type.name})` : '';

    // Progres dilewatkan untuk tipe yang tidak melacaknya — "Hal. 0" pada
    // sebuah artikel tidak berarti apa-apa bagi yang membacanya.
    const progres =
      type?.tracksProgress === false
        ? ''
        : ` — ${formatProgress(shortUnit(work.progressUnit), work.progressCurrent, work.progressTotal)}`;

    const tautan = work.sourceUrl?.trim() ? `\n   ${work.sourceUrl.trim()}` : '';

    return `${index + 1}. ${work.title}${type_}${progres}${tautan}`;
  });

  return `${heading}\n\n${baris.join('\n')}`;
}

/**
 * Membagikan teks lewat lembar berbagi sistem.
 *
 * Di web tidak ada lembar berbagi yang bisa diandalkan, jadi teksnya disalin ke
 * papan klip. Nilai baliknya membedakan keduanya supaya pemanggil bisa
 * mengatakan yang sebenarnya terjadi — "dibagikan" pada sesuatu yang sebenarnya
 * hanya disalin akan membuat pengguna mencari-cari aplikasi tujuan yang tidak
 * pernah muncul.
 */
export async function shareText(
  text: string,
  title: string,
): Promise<'bagikan' | 'salin'> {
  if (isNative()) {
    await Share.share({ title, text });
    return 'bagikan';
  }

  await navigator.clipboard.writeText(text);
  return 'salin';
}
