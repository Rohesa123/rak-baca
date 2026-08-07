import { useState } from 'react';
import { PANJANG_PIN, TENGGANG_DETIK, useLockStore } from '../../stores/lock.store';
import { useT } from '../../i18n/useT';
import { Button } from '../../components/ui/Button';

type Mode = 'idle' | 'set' | 'remove';

/** Kolom PIN, dipakai untuk memasang maupun mencabut. */
function PinField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-sm text-muted">{label}</span>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={PANJANG_PIN}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, PANJANG_PIN))}
        className="h-11 w-32 rounded-xl border border-border bg-elevated px-3 text-center text-lg tracking-[0.3em] text-ink outline-none focus:border-brand"
      />
    </label>
  );
}

export function LockSettings() {
  const t = useT();
  const hash = useLockStore((state) => state.hash);
  const setPinStore = useLockStore((state) => state.setPin);
  const removePin = useLockStore((state) => state.removePin);

  const [mode, setMode] = useState<Mode>('idle');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const aktif = hash !== null;

  function reset() {
    setMode('idle');
    setPin('');
    setConfirm('');
    setError(null);
  }

  async function simpan() {
    if (pin.length < PANJANG_PIN) return;
    if (pin !== confirm) {
      setError(t('lock.mismatch'));
      return;
    }
    await setPinStore(pin);
    reset();
    setMessage(t('lock.enabled'));
  }

  async function cabut() {
    if (pin.length < PANJANG_PIN) return;
    const berhasil = await removePin(pin);
    if (!berhasil) {
      setError(t('lock.wrong'));
      return;
    }
    reset();
    setMessage(t('lock.disabled'));
  }

  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted">{t('lock.title')}</h2>

      <p className="text-sm text-ink">
        {aktif ? t('lock.statusOn', { seconds: TENGGANG_DETIK }) : t('lock.statusOff')}
      </p>

      {mode === 'idle' && (
        <div className="flex gap-2">
          {aktif ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setMode('set')}>
                {t('lock.change')}
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setMode('remove')}>
                {t('lock.turnOff')}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setMode('set')}>
              {t('lock.turnOn')}
            </Button>
          )}
        </div>
      )}

      {mode === 'set' && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated p-3">
          <PinField id="pin-baru" label={t('lock.newPin')} value={pin} onChange={setPin} />
          <PinField id="pin-ulang" label={t('lock.repeatPin')} value={confirm} onChange={setConfirm} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" disabled={pin.length < PANJANG_PIN} onClick={() => void simpan()}>
              {t('action.save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              {t('action.cancel')}
            </Button>
          </div>
        </div>
      )}

      {mode === 'remove' && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-elevated p-3">
          {/* Mencabut kunci tetap menuntut PIN-nya: kalau tidak, siapa pun yang
              sudah terlanjur masuk bisa mematikannya diam-diam. */}
          <PinField id="pin-cabut" label={t('lock.currentPin')} value={pin} onChange={setPin} />
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" className="text-danger" variant="ghost" disabled={pin.length < PANJANG_PIN} onClick={() => void cabut()}>
              {t('lock.turnOff')}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              {t('action.cancel')}
            </Button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-muted">{message}</p>}

      {/*
        Batas fitur ini dinyatakan terang-terangan, bukan disamarkan. Kunci ini
        penghalang tampilan; isinya sama sekali tidak dienkripsi. Menjanjikan
        lebih dari yang diberikan justru membuat orang menyimpan hal yang
        seharusnya tidak mereka simpan di sini.
      */}
      <p className="text-xs leading-relaxed text-muted">{t('lock.scopeNote')}</p>
      <p className="text-xs leading-relaxed text-warning">{t('lock.forgotNote')}</p>
    </section>
  );
}
