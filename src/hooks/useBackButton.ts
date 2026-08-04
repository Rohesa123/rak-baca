import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { isNative } from '../lib/platform';
import { useDialogStore } from '../stores/dialog.store';

/**
 * Tombol Back fisik Android. Tanpa ini, Back langsung menutup aplikasi dari
 * layar mana pun — termasuk saat form buku sedang terisi.
 *
 * Urutan penanganannya:
 *   1. Ada dialog terbuka  -> tutup dialognya saja
 *   2. Bukan di halaman akar -> mundur satu langkah riwayat
 *   3. Di halaman akar     -> kecilkan aplikasi, bukan keluar, supaya
 *                             kembali ke aplikasi tidak memuat ulang WebView
 */
export function useBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const closeTop = useDialogStore((state) => state.closeTop);

  useEffect(() => {
    if (!isNative()) return;

    let handle: PluginListenerHandle | undefined;
    let cancelled = false;

    const listener = App.addListener('backButton', () => {
      if (closeTop()) return;

      if (location.pathname !== '/') {
        void navigate(-1);
        return;
      }

      void App.minimizeApp();
    });

    void listener.then((registered) => {
      // Effect bisa saja sudah dibersihkan sebelum pendaftaran selesai.
      if (cancelled) void registered.remove();
      else handle = registered;
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [closeTop, location.pathname, navigate]);
}
