import { useEffect, useState } from 'react';

/**
 * Membuat object URL dari sebuah Blob dan mencabutnya saat blob berganti atau
 * komponen di-unmount.
 *
 * Tanpa `revokeObjectURL`, setiap kartu yang di-scroll keluar akan meninggalkan
 * blob-nya di memori sampai halaman ditutup — bocor yang tidak terlihat sampai
 * koleksinya besar.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}
