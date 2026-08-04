import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNative } from './platform';

/**
 * Semua fungsi di sini bersifat polish. Kalau plugin gagal — versi Android
 * tertentu, WebView aneh, atau plugin belum tersinkron — aplikasinya harus
 * tetap jalan normal, jadi kegagalannya ditelan diam-diam dan tidak pernah
 * dilempar ke pemanggil.
 */

export async function hideSplashScreen(): Promise<void> {
  if (!isNative()) return;

  try {
    await SplashScreen.hide();
  } catch {
    // Diabaikan: splash yang tidak sempat disembunyikan bukan alasan
    // menggagalkan render aplikasi.
  }
}

/** Warna harus dijaga sama dengan token --color-surface di src/index.css. */
const STATUS_BAR_BACKGROUND = { light: '#FFFFFF', dark: '#18181B' };

export async function applyStatusBarTheme(dark: boolean): Promise<void> {
  if (!isNative()) return;

  try {
    // Style.Dark = teks terang untuk latar gelap, jadi penamaannya mengikuti
    // warna latar, bukan warna teksnya.
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    // setBackgroundColor hanya berlaku di Android; di iOS ini no-op.
    await StatusBar.setBackgroundColor({
      color: dark ? STATUS_BAR_BACKGROUND.dark : STATUS_BAR_BACKGROUND.light,
    });
  } catch {
    // Diabaikan.
  }
}

/** Getaran singkat untuk mengonfirmasi aksi yang tidak bisa dibatalkan. */
export async function impactFeedback(): Promise<void> {
  if (!isNative()) return;

  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Diabaikan: banyak perangkat mematikan haptics dari pengaturan sistem.
  }
}
