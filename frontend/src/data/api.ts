// HTTP client for the backend API. It attaches the access token, unwraps the `{ success, data }` envelope and turns
// every failure into an ApiError with a machine-readable code. It never notifies the user itself: the caller
// decides whether an error becomes a toast (mutations) or an error state (reads).
import axios, { isAxiosError } from 'axios';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'INTERNAL';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
};

const isErrorEnvelope = (body: unknown): body is { error: { code: ErrorCode; message: string } } =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  typeof (body as { error: unknown }).error === 'object';

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!isAxiosError(error)) {
    return new ApiError('INTERNAL', error instanceof Error ? error.message : String(error));
  }
  const { response } = error;
  if (!response) {
    const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
    return new ApiError(timedOut ? 'TIMEOUT' : 'NETWORK', error.message);
  }
  // Vercel answers an oversized request with its own 413 and no envelope; the rate limiter answers 429 in plain text.
  if (response.status === 413 || response.status === 429) {
    return new ApiError(CODE_BY_STATUS[response.status], String(response.data ?? ''));
  }
  if (isErrorEnvelope(response.data)) {
    return new ApiError(response.data.error.code, response.data.error.message);
  }
  return new ApiError(CODE_BY_STATUS[response.status] ?? 'INTERNAL', error.message);
}

let token: string | null = null;

export const setAuthToken = (newToken: string | null) => {
  token = newToken;
};

const http = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  timeout: 30_000,
});

http.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(undefined, (error) => Promise.reject(toApiError(error)));

export const api = {
  get: async <T>(url: string, params?: Record<string, string | undefined>) =>
    (await http.get<{ data: T }>(url, { params })).data.data,
  post: async <T>(url: string, body: unknown) =>
    (await http.post<{ data: T }>(url, body)).data.data,
  patch: async <T>(url: string, body: unknown) =>
    (await http.patch<{ data: T }>(url, body)).data.data,
  delete: async (url: string) => {
    await http.delete(url);
  },
};
