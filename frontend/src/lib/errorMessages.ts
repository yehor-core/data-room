import { isAxiosError } from 'axios';

export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
export const FILE_TOO_LARGE_MESSAGE = 'File is too large. Maximum size is 4.5MB.';

const ERROR_MESSAGES = {
  NETWORK: 'Unable to connect. Please check your internet connection and try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: "You don't have permission to perform this action.",
  NOT_FOUND: 'The requested item could not be found. It may have been deleted.',
  DUPLICATE: 'An item with this name already exists. Please choose a different name.',
  INVALID_INPUT: 'Invalid input. Please check your data and try again.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again in a few moments.',
} as const;

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (error.response) {
      switch (error.response.status) {
        case 400:
          return error.response.data.message || ERROR_MESSAGES.INVALID_INPUT;
        case 401:
          return ERROR_MESSAGES.UNAUTHORIZED;
        case 403:
          return ERROR_MESSAGES.FORBIDDEN;
        case 404:
          return ERROR_MESSAGES.NOT_FOUND;
        case 409:
          return error.response.data.message || ERROR_MESSAGES.DUPLICATE;
        case 413:
          return FILE_TOO_LARGE_MESSAGE;
        case 500:
          return ERROR_MESSAGES.SERVER_ERROR;
        default:
          if (error.response.data && error.response.data.message) {
            return error.response.data.message;
          }
          return `Error: ${error.response.status} ${error.response.statusText}`;
      }
    } else if (error.request) {
      return ERROR_MESSAGES.NETWORK;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

export const SUCCESS_MESSAGES = {
  DATA_ROOM_CREATED: 'Data room created successfully!',
  DATA_ROOM_DELETED: 'Data room deleted successfully!',
  FOLDER_CREATED: 'Folder created successfully!',
  FOLDER_DELETED: 'Folder deleted successfully!',
  FILE_UPLOADED: 'File uploaded successfully!',
  FILE_DELETED: 'File deleted successfully!',
  LOGIN_SUCCESS: 'Successfully logged in!',
} as const;
