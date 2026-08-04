/**
 * Dexie melempar error dengan `name = 'ConstraintError'` saat unique index
 * dilanggar — dipakai untuk membedakan "nama sudah dipakai" dari kegagalan
 * penyimpanan yang sesungguhnya.
 */
export function isConstraintError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ConstraintError';
}
