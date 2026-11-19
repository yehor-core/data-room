import { ApiError, type ErrorCode } from '@/data/api';
import { FILE_TOO_LARGE_MESSAGE, UNSUPPORTED_FILE_TYPE_MESSAGE } from '@/data/uploads';

const MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: 'Your session has expired. Please sign in again.',
  NOT_FOUND: 'The item could not be found. It may have been deleted.',
  CONFLICT: 'An item with this name already exists. Please choose a different name.',
  VALIDATION_FAILED: 'Invalid input. Please check your data and try again.',
  PAYLOAD_TOO_LARGE: FILE_TOO_LARGE_MESSAGE,
  UNSUPPORTED_MEDIA_TYPE: UNSUPPORTED_FILE_TYPE_MESSAGE,
  RATE_LIMITED: 'Too many requests. Please wait a few minutes and try again.',
  NETWORK: 'Unable to connect. Please check your internet connection and try again.',
  TIMEOUT: 'The request timed out. Please try again.',
  INTERNAL: 'Something went wrong on our end. Please try again in a few moments.',
};

// For these codes the server's own message is more specific (which name clashes, which field is invalid).
const SERVER_MESSAGE_FIRST = new Set<ErrorCode>(['CONFLICT', 'VALIDATION_FAILED']);

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGES.INTERNAL;
  if (SERVER_MESSAGE_FIRST.has(error.code) && error.message) return error.message;
  return MESSAGES[error.code];
}

export const SUCCESS_MESSAGES = {
  DATA_ROOM_CREATED: 'Data room created successfully!',
  DATA_ROOM_DELETED: 'Data room deleted successfully!',
  FOLDER_CREATED: 'Folder created successfully!',
  FOLDER_RENAMED: 'Folder renamed successfully!',
  FOLDER_DELETED: 'Folder deleted successfully!',
  FILE_UPLOADED: 'File uploaded successfully!',
  FILE_RENAMED: 'File renamed successfully!',
  FILE_DELETED: 'File deleted successfully!',
  LOGIN_SUCCESS: 'Successfully logged in!',
} as const;
