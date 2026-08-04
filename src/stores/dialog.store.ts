import { create } from 'zustand';

type CloseFn = () => void;

interface DialogState {
  stack: CloseFn[];
  push: (close: CloseFn) => void;
  remove: (close: CloseFn) => void;
  /** Menutup dialog paling atas. Mengembalikan true kalau memang ada yang ditutup. */
  closeTop: () => boolean;
}

/**
 * Radix menangani tombol Escape, tapi tidak tahu apa-apa soal tombol Back fisik
 * Android. Tanpa daftar ini, menekan Back saat dialog konfirmasi terbuka akan
 * memindahkan halaman di belakangnya sambil membiarkan dialognya menggantung.
 *
 * Setiap dialog mendaftarkan fungsi penutupnya selagi terbuka, dan handler
 * tombol Back menutup yang teratas lebih dulu sebelum menyentuh navigasi.
 */
export const useDialogStore = create<DialogState>((set, get) => ({
  stack: [],

  push: (close) => set((state) => ({ stack: [...state.stack, close] })),

  remove: (close) => set((state) => ({ stack: state.stack.filter((fn) => fn !== close) })),

  closeTop: () => {
    const { stack } = get();
    const top = stack[stack.length - 1];
    if (!top) return false;

    top();
    return true;
  },
}));
