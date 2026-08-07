import { create } from 'zustand';
import { Preferences } from '@capacitor/preferences';

const KEY_HASH = 'lock.hash';
const KEY_SALT = 'lock.salt';

/** Selama ini, kembali dari aplikasi lain tidak dianggap meninggalkan aplikasi. */
export const TENGGANG_DETIK = 60;

export const PANJANG_PIN = 4;

/**
 * PIN disimpan sebagai hash SHA-256 bergaram, bukan apa adanya.
 *
 * Ini **tidak** menjadikannya kriptografi yang sungguhan — lihat catatan
 * panjang di bawah tentang apa yang sebenarnya dilindungi. Tetapi menyimpan
 * PIN apa adanya berarti siapa pun yang membuka penyimpanan aplikasi langsung
 * membacanya, dan itu kelalaian yang tidak ada alasannya: hashing di sini
 * praktis gratis.
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface LockState {
  /** `null` berarti kunci belum pernah dipasang. */
  hash: string | null;
  salt: string | null;
  /** Sedang terkunci sekarang. Tidak pernah disimpan — selalu mulai dari awal. */
  locked: boolean;
  /** Kapan aplikasi terakhir ditinggalkan, untuk menghitung tenggang. */
  leftAt: number | null;
  hydrated: boolean;

  setPin: (pin: string) => Promise<void>;
  removePin: (pin: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  markLeft: () => void;
  maybeRelock: () => void;
  hydrate: () => Promise<void>;
}

/**
 * Kunci aplikasi.
 *
 * **Yang dilindungi:** orang yang meminjam ponsel dan membuka aplikasinya.
 * Model data ini punya medan rating usia sampai 18+, jadi sebagian koleksi
 * memang tidak dimaksudkan untuk dilihat sembarang orang.
 *
 * **Yang TIDAK dilindungi:** isinya sama sekali tidak dienkripsi. Siapa pun
 * yang bisa membongkar penyimpanan perangkat — lewat ADB, root, atau cadangan
 * sistem — tetap membacanya utuh tanpa perlu tahu PIN-nya. Ini penghalang
 * tampilan, bukan keamanan, dan layar pengaturannya wajib mengatakan begitu.
 *
 * Enkripsi sungguhan jauh lebih rumit dan menjadikan PIN yang lupa
 * benar-benar tidak bisa dipulihkan. Kalau suatu saat dibutuhkan, itu
 * pekerjaan tersendiri — jangan diam-diam dijanjikan oleh fitur ini.
 */
export const useLockStore = create<LockState>((set, get) => ({
  hash: null,
  salt: null,
  locked: false,
  leftAt: null,
  hydrated: false,

  setPin: async (pin) => {
    const salt = newSalt();
    const hash = await hashPin(pin, salt);
    set({ hash, salt, locked: false });
    await Preferences.set({ key: KEY_SALT, value: salt });
    await Preferences.set({ key: KEY_HASH, value: hash });
  },

  removePin: async (pin) => {
    // Mematikan kunci tetap menuntut PIN-nya. Kalau tidak, siapa pun yang
    // sudah terlanjur masuk bisa mencabutnya diam-diam.
    const { hash, salt } = get();
    if (!hash || !salt) return true;
    if ((await hashPin(pin, salt)) !== hash) return false;

    set({ hash: null, salt: null, locked: false });
    await Preferences.remove({ key: KEY_HASH });
    await Preferences.remove({ key: KEY_SALT });
    return true;
  },

  unlock: async (pin) => {
    const { hash, salt } = get();
    if (!hash || !salt) {
      set({ locked: false });
      return true;
    }
    if ((await hashPin(pin, salt)) !== hash) return false;

    set({ locked: false, leftAt: null });
    return true;
  },

  markLeft: () => set({ leftAt: Date.now() }),

  maybeRelock: () => {
    const { hash, leftAt } = get();
    if (!hash || leftAt === null) return;

    // Ada tenggang karena alur pemakaian aplikasi ini justru berpindah
    // aplikasi: baca di peramban, kembali ke sini untuk mencatat posisinya.
    // Mengunci setiap kali berpindah akan membuat fiturnya dimatikan pada hari
    // pertama, dan kunci yang dimatikan tidak melindungi apa pun.
    if (Date.now() - leftAt >= TENGGANG_DETIK * 1000) set({ locked: true });
    set({ leftAt: null });
  },

  hydrate: async () => {
    try {
      const [hash, salt] = await Promise.all([
        Preferences.get({ key: KEY_HASH }),
        Preferences.get({ key: KEY_SALT }),
      ]);

      const punyaPin = Boolean(hash.value && salt.value);
      set({
        hash: hash.value ?? null,
        salt: salt.value ?? null,
        // Terkunci sejak awal kalau PIN terpasang. Keadaan terkunci sengaja
        // tidak pernah disimpan: kalau disimpan, "tidak terkunci" yang
        // tertinggal dari sesi sebelumnya akan membuka aplikasi begitu saja.
        locked: punyaPin,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },
}));
