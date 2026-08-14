import { Suspense, useEffect } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { Book, Settings, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBackButton } from '../hooks/useBackButton';
import { useTheme } from '../hooks/useTheme';
import { hideSplashScreen } from '../lib/native';
import { useImageQualityStore } from '../stores/imageQuality.store';
import { useLanguageStore } from '../stores/language.store';
import { useBackupReminderStore } from '../stores/backupReminder.store';
import { useLockStore } from '../stores/lock.store';
import { useViewModeStore } from '../stores/viewMode.store';
import { LockScreen } from '../components/ui/LockScreen';
import { isNative } from '../lib/platform';
import { readSharedFromUrl } from '../lib/shareIntent';
import { useT } from '../i18n/useT';
import type { MessageKey } from '../i18n/messages';

interface NavItem {
  to: string;
  labelKey: MessageKey;
  Icon: LucideIcon;
  /** Awalan path yang membuat tab ini dianggap aktif. */
  matches: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.works', Icon: Book, matches: ['/karya'] },
  { to: '/katalog', labelKey: 'nav.catalog', Icon: Tag, matches: ['/katalog'] },
  { to: '/pengaturan', labelKey: 'nav.settings', Icon: Settings, matches: ['/pengaturan'] },
];

export function Layout() {
  const { pathname } = useLocation();
  const t = useT();
  const locked = useLockStore((state) => state.locked);
  const navigate = useNavigate();

  useTheme();
  useBackButton();

  // Splash disembunyikan setelah React benar-benar merender, bukan lewat
  // launchAutoHide berbasis waktu — itulah yang menghilangkan kedipan putih
  // saat WebView masih memuat bundel.
  useEffect(() => {
    void hideSplashScreen();
    // Dimuat di sini, bukan di halaman Pengaturan: preset dan bahasa harus
    // sudah siap sebelum layar mana pun sempat memakainya.
    void useImageQualityStore.getState().hydrate();
    void useLanguageStore.getState().hydrate();
    void useBackupReminderStore.getState().hydrate();
    void useLockStore.getState().hydrate();
    void useViewModeStore.getState().hydrate();
  }, []);

  // Kiriman dari lembar "Bagikan" milik Android.
  //
  // MainActivity menuliskan ulang ACTION_SEND jadi tautan berskema aplikasi
  // ini, sehingga yang sampai ke sini adalah deep link biasa — Capacitor tidak
  // mengenal ACTION_SEND sama sekali.
  //
  // Dua jalur, dan keduanya diperlukan: `getLaunchUrl` untuk peluncuran dingin,
  // `appUrlOpen` untuk berbagi saat aplikasi sudah berjalan.
  useEffect(() => {
    if (!isNative()) return;

    let handle: PluginListenerHandle | undefined;
    let cancelled = false;

    const bukaForm = (url?: string | null) => {
      const shared = readSharedFromUrl(url);
      if (!shared) return;
      // Dibawa lewat state rute, bukan query string: isinya judul dan tautan
      // milik pengguna, dan URL bisa berakhir di riwayat maupun log.
      void navigate('/karya/baru', { state: { shared }, replace: true });
    };

    void App.getLaunchUrl().then((result) => {
      if (!cancelled) bukaForm(result?.url);
    });

    void App.addListener('appUrlOpen', ({ url }) => bukaForm(url)).then((registered) => {
      if (cancelled) void registered.remove();
      else handle = registered;
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, [navigate]);

  // Mengunci ulang saat aplikasi ditinggalkan lebih lama dari tenggang.
  // Tanpa ini, kunci hanya berlaku pada peluncuran dingin — sementara kasus
  // yang justru ingin dicegah adalah ponsel yang dipinjam sementara
  // aplikasinya masih terbuka di daftar aplikasi terkini.
  useEffect(() => {
    if (!isNative()) return;

    let handle: PluginListenerHandle | undefined;
    let cancelled = false;

    void App.addListener('appStateChange', ({ isActive }) => {
      const lock = useLockStore.getState();
      if (isActive) lock.maybeRelock();
      else lock.markLeft();
    }).then((registered) => {
      if (cancelled) void registered.remove();
      else handle = registered;
    });

    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);

  // NavLink dengan `end` tidak cukup: tab Buku harus tetap menyala saat
  // pengguna berada di /buku/:id atau /buku/baru.
  function isActive(item: NavItem): boolean {
    if (pathname === item.to) return true;
    return item.matches.some((prefix) => pathname.startsWith(prefix));
  }

  // Dirender menggantikan seluruh isi aplikasi, bukan melapisinya, supaya
  // judul karya tidak sempat terbaca sekilas di baliknya.
  if (locked) return <LockScreen />;

  return (
    <div className="flex h-full flex-col bg-surface">
      <main
        className="flex-1 overflow-y-auto"
        // Wajib. Sejak targetSdk 35, Android memaksa mode edge-to-edge: WebView
        // menggambar sampai ke belakang status bar, sehingga judul halaman
        // tertimpa jam dan ikon notifikasi kalau inset ini tidak dipasang.
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Fallback sengaja kosong: chunk halaman dimuat dari penyimpanan
            lokal APK, jadi jedanya terlalu singkat untuk pantas menampilkan
            indikator yang malah terlihat berkedip. */}
        <Suspense fallback={null}>
          {/* `key` memaksa animasi terputar ulang setiap perpindahan rute.
              Efek sampingnya komponen halaman di-mount ulang — di sini tidak
              merugikan, karena filter dan tema hidup di store, bukan di state
              komponen. */}
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>

      <nav
        className="shrink-0 border-t border-border bg-surface"
        // Sisakan ruang untuk gesture bar Android agar tab tidak tertutup.
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto flex max-w-lg">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const { Icon } = item;

            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                    active ? 'text-brand' : 'text-muted'
                  }`}
                >
                  <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
