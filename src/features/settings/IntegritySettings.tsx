import { useState } from 'react';
import { reportIsClean, repairIntegrity, scanIntegrity } from '../../lib/integrity';
import type { IntegrityReport } from '../../lib/integrity';
import { formatBytes } from '../../lib/format';
import { useT } from '../../i18n/useT';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

/**
 * Pemeriksa keutuhan data.
 *
 * Dua tahap yang sengaja dipisah: **memindai tidak menyentuh apa pun**, dan
 * merapikan hanya membuang persis yang sudah dilaporkan. Ini satu-satunya
 * tempat di aplikasi ini yang menghapus data tanpa pengguna menunjuk barisnya
 * satu per satu, di aplikasi yang tidak punya cadangan otomatis — jadi
 * urutannya harus selalu lihat dulu, setujui, baru hapus.
 */
export function IntegritySettings() {
  const t = useT();
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function scan() {
    setBusy(true);
    setMessage(null);
    try {
      setReport(await scanIntegrity());
    } finally {
      setBusy(false);
    }
  }

  async function repair() {
    if (!report) return;
    setBusy(true);
    setConfirm(false);
    try {
      // Laporan yang sama yang dilihat pengguna, bukan hasil pindai ulang.
      await repairIntegrity(report);
      setMessage(t('integrity.repaired', { size: formatBytes(report.reclaimableBytes) }));
      setReport(null);
    } finally {
      setBusy(false);
    }
  }

  const bersih = report !== null && reportIsClean(report);

  const temuan = report
    ? ([
        [report.danglingPrimary.length, 'integrity.danglingPrimary'],
        [report.orphanImages.length, 'integrity.orphanImages'],
        [report.orphanBlobs.length, 'integrity.orphanBlobs'],
        [report.danglingTaxonomies.length, 'integrity.danglingTaxonomies'],
      ] as const)
    : [];

  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted">{t('integrity.title')}</h2>
      <p className="text-xs leading-relaxed text-muted">{t('integrity.note')}</p>

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void scan()}>
          {busy ? t('common.processing') : t('integrity.scan')}
        </Button>
      </div>

      {bersih && <p className="text-sm text-ink">{t('integrity.clean')}</p>}

      {report && !bersih && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning bg-elevated p-3">
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {temuan
              .filter(([count]) => count > 0)
              .map(([count, key]) => (
                <li key={key}>{t(key, { count })}</li>
              ))}
          </ul>

          {report.reclaimableBytes > 0 && (
            <p className="text-sm text-muted">
              {t('integrity.reclaimable', { size: formatBytes(report.reclaimableBytes) })}
            </p>
          )}

          {/* Disarankan mengekspor lebih dulu, sama seperti seluruh operasi
              merusak lain di aplikasi ini. */}
          <p className="text-xs leading-relaxed text-muted">{t('integrity.backupFirst')}</p>

          <div>
            <Button size="sm" disabled={busy} onClick={() => setConfirm(true)}>
              {t('integrity.repair')}
            </Button>
          </div>
        </div>
      )}

      {message && <p className="text-sm text-muted">{message}</p>}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('integrity.confirmTitle')}
        description={t('integrity.confirmBody')}
        confirmLabel={t('integrity.repair')}
        onConfirm={() => void repair()}
      />
    </section>
  );
}
