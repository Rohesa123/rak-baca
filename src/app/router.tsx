import { lazy } from 'react';
import { Navigate, createHashRouter } from 'react-router';
import { Layout } from './Layout';
import { WorksPage } from '../features/works/WorksPage';

/**
 * Hanya daftar karya yang ikut bundel awal — itulah layar pertama yang selalu
 * dibuka. Sisanya dimuat saat rutenya benar-benar dikunjungi, sehingga
 * pembukaan aplikasi tidak menunggu kode form, katalog, dan pengaturan.
 */
const lazyPage = <T extends string>(
  loader: () => Promise<Record<T, React.ComponentType>>,
  name: T,
) => lazy(() => loader().then((module) => ({ default: module[name] })));

const WorkDetailPage = lazyPage(
  () => import('../features/works/WorkDetailPage'),
  'WorkDetailPage',
);
const WorkFormPage = lazyPage(
  () => import('../features/works/WorkFormPage'),
  'WorkFormPage',
);
const TaxonomiesPage = lazyPage(
  () => import('../features/taxonomies/TaxonomiesPage'),
  'TaxonomiesPage',
);
const SettingsPage = lazyPage(
  () => import('../features/settings/SettingsPage'),
  'SettingsPage',
);
const StatsPage = lazyPage(() => import('../features/stats/StatsPage'), 'StatsPage');

/**
 * Hash router, bukan browser router. Capacitor menyajikan aplikasi dari
 * https://localhost di Android tapi http://localhost:5173 saat dev; rute
 * berbasis hash menghindari 404 saat refresh karena tidak ada server yang
 * menangani fallback.
 */
export const router = createHashRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: WorksPage },
      // Segmen statis diprioritaskan React Router di atas segmen dinamis,
      // jadi "/karya/baru" tidak akan tertangkap oleh "/karya/:id".
      { path: 'karya/baru', Component: WorkFormPage },
      { path: 'karya/:id', Component: WorkDetailPage },
      { path: 'karya/:id/ubah', Component: WorkFormPage },
      { path: 'katalog', Component: TaxonomiesPage },
      { path: 'pengaturan', Component: SettingsPage },
      // Tanpa tab sendiri: statistik dilihat sesekali, dan menambah tab
      // keempat menyempitkan tiga tab yang dipakai setiap hari.
      { path: 'statistik', Component: StatsPage },
      // Tanpa ini, hash yang salah ketik atau tautan lama menghasilkan layar
      // kosong tanpa penjelasan. Di aplikasi, mengembalikan ke beranda jauh
      // lebih berguna daripada halaman "tidak ditemukan".
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
