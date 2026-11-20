import { formatBytes } from '@/lib/utils';

// Must match the backend (backend/src/access/uploads.ts): 4 MB inclusive, PDF only.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ['application/pdf'];

export const FILE_TOO_LARGE_MESSAGE = `File is too large. The maximum size is ${formatBytes(MAX_UPLOAD_BYTES)}.`;
export const UNSUPPORTED_FILE_TYPE_MESSAGE = 'Only PDF files are accepted.';

/** Why the file can't be uploaded, or null when it can. */
export const validateUpload = (file: { size: number; type: string }): string | null => {
  if (file.size > MAX_UPLOAD_BYTES) return FILE_TOO_LARGE_MESSAGE;
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return UNSUPPORTED_FILE_TYPE_MESSAGE;
  return null;
};
