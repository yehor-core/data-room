import { AppError } from '../errors';

/** Upload rules. The frontend defines the same values; keep them equal. */
export const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = ['application/pdf'];

export const FILE_TOO_LARGE_MESSAGE = `File is larger than the ${MAX_UPLOAD_MB} MB limit`;

const PDF_SIGNATURE = Buffer.from('%PDF-');

/** Throws unless the content is within the size limit and is a PDF both by its declared type and by its bytes. */
export function checkUpload({ mimeType, content }: { mimeType: string; content: Buffer }) {
  if (content.length > MAX_UPLOAD_BYTES) throw new AppError('PAYLOAD_TOO_LARGE', FILE_TOO_LARGE_MESSAGE);
  if (!ACCEPTED_MIME_TYPES.includes(mimeType) || !content.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Only PDF files are accepted');
  }
}
