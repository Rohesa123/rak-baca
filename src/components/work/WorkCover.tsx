import { Book } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { imagesRepo } from '../../db/images.repo';
import { useObjectUrl } from '../../hooks/useObjectUrl';

interface WorkCoverProps {
  imageId: string | null;
  alt?: string;
  /** Kelas ukuran dari pemanggil, mis. "h-20 w-14" atau "h-60 w-40". */
  className?: string;
}

/**
 * Selalu memakai thumbnail, tidak pernah berkas penuh. Pada 200px, thumbnail
 * masih tajam untuk sampul selebar 160px di halaman detail sekalipun — berkas
 * penuh hanya diperlukan oleh penampil layar penuh.
 */
export function WorkCover({ imageId, alt = '', className = '' }: WorkCoverProps) {
  const image = useLiveQuery(
    () => (imageId ? imagesRepo.get(imageId) : undefined),
    [imageId],
  );

  const url = useObjectUrl(image?.thumbBlob);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface text-muted ${className}`}
    >
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <Book className="h-2/5 w-2/5" strokeWidth={1.5} aria-hidden="true" />
      )}
    </div>
  );
}
