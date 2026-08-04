export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Menerima `#abc`, `abc`, `#aabbcc`, atau `aabbcc`. `null` kalau tidak sah. */
export function parseHex(input: string): Rgb | null {
  const match = HEX_PATTERN.exec(input.trim());
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');

  return `#${part(r)}${part(g)}${part(b)}`;
}

function channelToLinear(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

/** Luminansi relatif menurut WCAG, 0 (hitam) sampai 1 (putih). */
export function luminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function contrastRatio(a: number, b: number): number {
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high + 0.05) / (low + 0.05);
}

/**
 * Memilih hitam atau putih untuk teks di atas warna aksen, mana pun yang
 * kontrasnya lebih tinggi.
 *
 * Ini bukan detail kosmetik. Kalau warna teks dipatok putih sementara pengguna
 * memilih kuning terang, seluruh tombol jadi tidak terbaca — dan pengguna tidak
 * akan tahu penyebabnya. Menghitungnya membuat pemilih warna bebas tetap aman.
 */
export function readableTextOn(background: Rgb): string {
  const backgroundLuminance = luminance(background);
  const againstWhite = contrastRatio(backgroundLuminance, 1);
  const againstBlack = contrastRatio(backgroundLuminance, 0);

  return againstWhite >= againstBlack ? '#ffffff' : '#0a0a0a';
}

function mixWithWhite(color: Rgb, amount: number): Rgb {
  return {
    r: color.r + (255 - color.r) * amount,
    g: color.g + (255 - color.g) * amount,
    b: color.b + (255 - color.b) * amount,
  };
}

/** Di bawah nilai ini, warna aksen tenggelam di latar gelap #18181b. */
const MIN_DARK_LUMINANCE = 0.22;

/**
 * Warna yang enak dilihat di latar terang sering terlalu gelap untuk latar
 * gelap — ungu #4c1d95 misalnya nyaris hilang. Warnanya dicerahkan bertahap
 * sampai cukup terbaca, bukan diganti dengan warna lain, supaya pilihan
 * pengguna tetap terasa dihormati.
 */
export function adaptForDark(color: Rgb): Rgb {
  if (luminance(color) >= MIN_DARK_LUMINANCE) return color;

  for (let amount = 0.1; amount <= 0.9; amount += 0.1) {
    const lifted = mixWithWhite(color, amount);
    if (luminance(lifted) >= MIN_DARK_LUMINANCE) return lifted;
  }

  return mixWithWhite(color, 0.9);
}
