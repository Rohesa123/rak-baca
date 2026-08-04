import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.co.dak.rakbaca',
  appName: 'Rak Baca',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Splash disembunyikan manual dari Layout setelah React merender, bukan
      // otomatis setelah sekian detik. Ini yang menghilangkan kedipan putih
      // saat WebView masih memuat bundel.
      launchAutoHide: false,
      backgroundColor: '#7C3AED',
      showSpinner: false,
    },
  },
};

export default config;
