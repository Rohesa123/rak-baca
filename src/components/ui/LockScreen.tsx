import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { PANJANG_PIN, useLockStore } from '../../stores/lock.store';
import { useT } from '../../i18n/useT';
import { Button } from './Button';

/**
 * Layar kunci. Menutupi seluruh aplikasi, bukan sekadar melapisinya.
 *
 * Dirender menggantikan isi aplikasi — bukan sebagai overlay di atasnya —
 * supaya judul karya tidak sempat terbaca sekilas di baliknya. Itu justru
 * satu-satunya hal yang dilindungi fitur ini.
 */
export function LockScreen() {
  const t = useT();
  const unlock = useLockStore((state) => state.unlock);

  const [pin, setPin] = useState('');
  const [salah, setSalah] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pin.length < PANJANG_PIN) return;

    const berhasil = await unlock(pin);
    if (!berhasil) {
      setSalah(true);
      setPin('');
      inputRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-surface px-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-on-brand">
        <Lock size={24} aria-hidden="true" />
      </div>

      <p className="text-center text-sm text-muted">{t('lock.prompt')}</p>

      <form onSubmit={(event) => void submit(event)} className="flex w-full max-w-sm flex-col gap-3">
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={PANJANG_PIN}
          value={pin}
          aria-label={t('lock.prompt')}
          onChange={(event) => {
            // Hanya angka. Menyaring di sini, bukan lewat `type=number`, supaya
            // titik desimal dan tanda minus tidak ikut bisa diketik.
            setPin(event.target.value.replace(/\D/g, '').slice(0, PANJANG_PIN));
            setSalah(false);
          }}
          className="h-14 w-full rounded-xl border border-border bg-elevated text-center text-2xl tracking-[0.5em] text-ink outline-none focus:border-brand"
        />

        {salah && (
          <p className="text-center text-sm text-danger" role="alert">
            {t('lock.wrong')}
          </p>
        )}

        <Button type="submit" disabled={pin.length < PANJANG_PIN}>
          {t('lock.open')}
        </Button>
      </form>

      {/* Tidak ada "lupa PIN". Menyediakan jalan keluar berarti menyediakan
          jalan masuk, dan tidak ada surel maupun akun yang bisa memverifikasi
          siapa yang menekannya. */}
      <p className="max-w-sm text-center text-xs leading-relaxed text-muted">
        {t('lock.noRecovery')}
      </p>
    </div>
  );
}
