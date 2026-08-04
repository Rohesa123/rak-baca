import { Suspense, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Book, Settings, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBackButton } from '../hooks/useBackButton';
import { useTheme } from '../hooks/useTheme';
import { hideSplashScreen } from '../lib/native';
import { useImageQualityStore } from '../stores/imageQuality.store';
import { useLanguageStore } from '../stores/language.store';
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
  }, []);

  // NavLink dengan `end` tidak cukup: tab Buku harus tetap menyala saat
  // pengguna berada di /buku/:id atau /buku/baru.
  function isActive(item: NavItem): boolean {
    if (pathname === item.to) return true;
    return item.matches.some((prefix) => pathname.startsWith(prefix));
  }

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
