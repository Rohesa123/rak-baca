import { useCallback } from 'react';
import { en, id } from './messages';
import type { MessageKey } from './messages';
import { useLanguageStore } from '../stores/language.store';

export type Translate = (
  key: MessageKey,
  params?: Record<string, string | number>,
) => string;

const DICTIONARIES = { id, en } as const;

/**
 * Mengembalikan fungsi penerjemah yang berubah identitasnya hanya saat bahasa
 * berganti, jadi aman dipakai sebagai dependensi hook.
 */
export function useT(): Translate {
  const lang = useLanguageStore((state) => state.lang);

  return useCallback<Translate>(
    (key, params) => {
      let text: string = DICTIONARIES[lang][key];

      if (params) {
        // Bentuk jamak: `{count|title|titles}`. Bahasa Indonesia tidak
        // menginfleksikan kata benda jadi kamusnya tidak memakai sintaks ini
        // sama sekali; bahasa Inggris memerlukannya, dan tanpa ini muncul
        // kejanggalan seperti "1 titles tracked".
        text = text.replace(
          /\{(\w+)\|([^|}]*)\|([^}]*)\}/g,
          (_match, name: string, one: string, other: string) =>
            Number(params[name]) === 1 ? one : other,
        );

        for (const [name, value] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(value));
        }
      }

      return text;
    },
    [lang],
  );
}
