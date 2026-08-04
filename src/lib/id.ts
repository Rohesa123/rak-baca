/**
 * ID di-generate di sisi klien supaya fitur ekspor/impor nanti tidak
 * bertabrakan antar perangkat.
 *
 * `crypto.randomUUID` hanya tersedia di secure context. Di dev localhost dan di
 * Capacitor Android (yang menyajikan lewat https://localhost) syarat itu
 * terpenuhi. Fallback-nya dipakai saat menguji dari HP lewat `vite --host`,
 * yang berjalan di http:// pada IP LAN dan karenanya tidak secure.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versi 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // varian RFC 4122

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
