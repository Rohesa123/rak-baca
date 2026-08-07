import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Download, Upload } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { worksRepo } from '../../db/works.repo';
import { db } from '../../db/database';
import { platformName } from '../../lib/platform';
import { parseHex } from '../../lib/color';
import { formatBytes } from '../../lib/format';
import { QUALITY_PRESETS } from '../../lib/image';
import type { QualityPreset } from '../../lib/image';
import { useThemeStore } from '../../stores/theme.store';
import type { ThemeMode } from '../../stores/theme.store';
import { useImageQualityStore } from '../../stores/imageQuality.store';
import { ACCENT_PRESETS, DEFAULT_ACCENT, useAccentStore } from '../../stores/accent.store';
import { useLanguageStore } from '../../stores/language.store';
import { AMBANG_HARI, useBackupReminderStore } from '../../stores/backupReminder.store';
import type { Language } from '../../stores/language.store';
import { useT } from '../../i18n/useT';
import type { MessageKey } from '../../i18n/messages';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextField } from '../../components/ui/TextField';
import { LockSettings } from './LockSettings';
import { IntegritySettings } from './IntegritySettings';

/**
 * Modul backup membawa `fflate` dan dua plugin Capacitor, sekitar 9 KB gzip,
 * dan hanya dipakai saat tombol di halaman ini benar-benar ditekan.
 */
const loadBackup = () => import('../../lib/backup');

/** Nama bahasa sengaja tidak diterjemahkan — selalu ditulis dalam bahasanya sendiri. */
const LANGUAGES: ReadonlyArray<{ value: Language; label: string }> = [
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'en', label: 'English' },
];

const THEME_OPTIONS: ReadonlyArray<{ value: ThemeMode; key: MessageKey }> = [
  { value: 'system', key: 'settings.theme.system' },
  { value: 'light', key: 'settings.theme.light' },
  { value: 'dark', key: 'settings.theme.dark' },
];

const QUALITY_OPTIONS: ReadonlyArray<{ value: QualityPreset; key: MessageKey }> = [
  { value: 'tinggi', key: 'settings.quality.high' },
  { value: 'sedang', key: 'settings.quality.medium' },
  { value: 'hemat', key: 'settings.quality.low' },
];

const PLATFORM_KEY: Record<string, MessageKey> = {
  web: 'settings.platform.web',
  android: 'settings.platform.android',
  ios: 'settings.platform.ios',
};

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-2.5">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}

export function SettingsPage() {
  const t = useT();

  const lang = useLanguageStore((state) => state.lang);
  const setLang = useLanguageStore((state) => state.setLang);

  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);

  const quality = useImageQualityStore((state) => state.preset);
  const setQuality = useImageQualityStore((state) => state.setPreset);
  const profile = QUALITY_PRESETS[quality];

  const accent = useAccentStore((state) => state.accent);
  const setAccent = useAccentStore((state) => state.setAccent);
  const [hexDraft, setHexDraft] = useState('');
  const [hexError, setHexError] = useState<string | null>(null);

  const recordBackup = useBackupReminderStore((state) => state.recordBackup);
  const remindEnabled = useBackupReminderStore((state) => state.enabled);
  const setRemindEnabled = useBackupReminderStore((state) => state.setEnabled);
  const lastBackupAt = useBackupReminderStore((state) => state.lastBackupAt);

  const workCount = useLiveQuery(() => worksRepo.count(), []);
  const imageCount = useLiveQuery(() => db.images.count(), []);

  const [usage, setUsage] = useState<number | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;

    void navigator.storage.estimate().then((estimate) => {
      setUsage(estimate.usage ?? 0);
    });
  }, [workCount, imageCount]);

  function applyHex() {
    const value = hexDraft.trim();
    if (!value) return;

    if (!parseHex(value)) {
      setHexError(t('settings.accent.invalid'));
      return;
    }

    setAccent(value.startsWith('#') ? value : `#${value}`);
    setHexDraft('');
    setHexError(null);
  }

  async function handleExport(includeImages: boolean) {
    setBackupBusy(true);
    setBackupMessage(null);
    setBackupError(null);

    try {
      const { buildExport, deliverExport } = await loadBackup();
      const result = await buildExport({ includeImages });
      const how = await deliverExport(result);

      // Hanya ekspor seluruh koleksi yang dihitung sebagai pencadangan.
      // Ekspor pilihan di halaman Rak sengaja tidak — sebagian koleksi bukan
      // cadangan, dan menganggapnya begitu memberi rasa aman yang keliru.
      //
      // Ekspor tanpa gambar tetap dihitung: seluruh catatan, tautan, dan
      // klasifikasi ikut terbawa, dan itu bagian yang benar-benar tidak
      // tergantikan.
      recordBackup();

      setBackupMessage(
        t('settings.backup.result', {
          works: result.workCount,
          images: result.imageCount,
          size: Math.max(1, Math.round(result.blob.size / 1024)),
          how: t(
            how === 'unduh'
              ? 'settings.backup.how.download'
              : 'settings.backup.how.share',
          ),
        }),
      );
    } catch {
      setBackupError(t('works.exportFailed'));
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Dikosongkan supaya memilih berkas yang sama dua kali tetap memicu change.
    event.target.value = '';
    if (!file) return;

    setBackupBusy(true);
    setBackupMessage(null);
    setBackupError(null);

    try {
      const { importBackup } = await loadBackup();
      const summary = await importBackup(file);

      const lines = [
        t('settings.backup.importResult', {
          added: summary.worksAdded,
          skipped: summary.worksSkipped,
          taxonomies: summary.taxonomiesAdded,
          images: summary.imagesAdded,
        }),
      ];

      if (summary.imagesBackfilled > 0) {
        lines.push(t('settings.backup.importBackfill', { count: summary.imagesBackfilled }));
      }

      setBackupMessage(lines.join(' '));
    } catch (error) {
      // Dikenali lewat `name`, bukan `instanceof`: kelasnya berada di modul
      // yang dimuat dinamis.
      const isFormatError = error instanceof Error && error.name === 'BackupFormatError';
      setBackupError(isFormatError ? error.message : t('settings.backup.importFailed'));
    } finally {
      setBackupBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-8">
      <PageHeader title={t('settings.title')} />

      <section className="mt-6 flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">{t('settings.language')}</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((option) => (
            <Chip
              key={option.value}
              active={lang === option.value}
              onClick={() => setLang(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">{t('settings.theme')}</h2>
        <div className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              active={mode === option.value}
              onClick={() => setMode(option.value)}
            >
              {t(option.key)}
            </Chip>
          ))}
        </div>
      </section>

      <section className="mt-8 flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">{t('settings.accent')}</h2>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('settings.accent')}>
          {ACCENT_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={accent.toLowerCase() === color}
              aria-label={color}
              onClick={() => setAccent(color)}
              style={{ background: color }}
              className={`h-9 w-9 rounded-full ${
                accent.toLowerCase() === color
                  ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface'
                  : ''
              }`}
            />
          ))}
        </div>

        <div className="flex items-end gap-2">
          <TextField
            id="warna-hex"
            label={t('settings.accent.customLabel')}
            placeholder={accent}
            value={hexDraft}
            onChange={(event) => {
              setHexDraft(event.target.value);
              setHexError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyHex();
              }
            }}
            error={hexError}
          />
          <Button className="mb-0.5" onClick={applyHex} disabled={!hexDraft.trim()}>
            {t('action.use')}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-on-brand">
            {t('settings.accent.sample')}
          </span>
          <span className="text-xs text-muted">
            {t('settings.accent.active', { color: accent })}
          </span>
          {accent.toLowerCase() !== DEFAULT_ACCENT && (
            <Button variant="ghost" size="sm" onClick={() => setAccent(DEFAULT_ACCENT)}>
              {t('action.restore')}
            </Button>
          )}
        </div>

        <p className="text-xs leading-relaxed text-muted">{t('settings.accent.note')}</p>
      </section>

      <section className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">{t('settings.quality')}</h2>
        <div className="flex flex-wrap gap-2">
          {QUALITY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              active={quality === option.value}
              onClick={() => setQuality(option.value)}
            >
              {t(option.key)}
            </Chip>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted">
          {t('settings.quality.note', {
            cover: profile.cover,
            art: profile.art,
            quality: Math.round(profile.quality * 100),
          })}
        </p>
      </section>

      <section className="mt-8 flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted">{t('settings.backup')}</h2>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={backupBusy}
            onClick={() => void handleExport(true)}
          >
            <Download size={16} />
            {t('settings.backup.exportFull')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={backupBusy}
            onClick={() => void handleExport(false)}
          >
            <Download size={16} />
            {t('settings.backup.exportLight')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={backupBusy}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={16} />
            {t('action.import')}
          </Button>
        </div>

        {/* Input berkas biasa: WebView Android meneruskannya ke pemilih berkas
            sistem, jadi tidak perlu plugin tambahan untuk impor. */}
        <input
          ref={importInputRef}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => void handleImport(event)}
        />

        {backupBusy && <p className="text-xs text-muted">{t('common.processing')}</p>}
        {backupMessage && <p className="text-xs text-ink">{backupMessage}</p>}
        {backupError && (
          <p role="alert" className="text-xs text-danger">
            {backupError}
          </p>
        )}

        <p className="text-xs leading-relaxed text-muted">{t('settings.backup.note')}</p>

        {/* Pengingat bisa dimatikan. Pengingat yang tidak bisa dibungkam
            berubah jadi gangguan, dan pengguna yang terganggu berhenti
            mempercayainya sama sekali. */}
        <label className="mt-1 flex items-start gap-3 border-t border-border pt-3">
          <input
            type="checkbox"
            checked={remindEnabled}
            onChange={(event) => setRemindEnabled(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-ink">{t('settings.backup.remind')}</span>
            <span className="text-xs text-muted">
              {t('settings.backup.remindNote', { days: AMBANG_HARI })}
            </span>
          </span>
        </label>

        <Row
          label={t('settings.backup.lastAt')}
          value={
            lastBackupAt === null
              ? t('settings.backup.never')
              : new Date(lastBackupAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
          }
        />
      </section>

      <LockSettings />

      <IntegritySettings />

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">{t('settings.storage')}</h2>
        <div className="mt-2">
          <Row
            label={t('settings.storage.works')}
            value={workCount === undefined ? '…' : String(workCount)}
          />
          <Row
            label={t('settings.storage.images')}
            value={imageCount === undefined ? '…' : String(imageCount)}
          />
          <Row
            label={t('settings.storage.used')}
            value={usage === null ? t('common.unknown') : formatBytes(usage)}
          />
          <Row
            label={t('settings.storage.platform')}
            value={
              PLATFORM_KEY[platformName()] ? t(PLATFORM_KEY[platformName()]) : platformName()
            }
          />
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-border bg-elevated p-3">
        <h2 className="font-medium text-ink">{t('settings.localOnly.title')}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {t('settings.localOnly.body')}
        </p>
      </section>
    </div>
  );
}
