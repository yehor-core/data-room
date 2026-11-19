import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { ApiError, toApiError } from '@/data/api';
import { getErrorMessage } from '@/lib/errorMessages';

const config = { headers: new AxiosHeaders() };
const response = (status: number, data: unknown): AxiosResponse => ({
  status,
  statusText: '',
  data,
  headers: {},
  config,
});
const httpError = (status: number, data: unknown) =>
  new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response(status, data));
const envelope = (code: string, message: string) => ({ success: false, error: { code, message } });

describe('toApiError', () => {
  it('reads the code and message from the error envelope', () => {
    const error = toApiError(
      httpError(409, envelope('CONFLICT', 'A folder with this name already exists')),
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'CONFLICT',
      message: 'A folder with this name already exists',
    });
  });

  it('treats any 413 as too large, even without an envelope', () => {
    expect(toApiError(httpError(413, 'Request Entity Too Large')).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('treats the plain-text 429 of the rate limiter as rate limiting', () => {
    expect(toApiError(httpError(429, 'Too many requests')).code).toBe('RATE_LIMITED');
  });

  it.each([
    [400, 'VALIDATION_FAILED'],
    [401, 'UNAUTHENTICATED'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [502, 'INTERNAL'],
  ])('falls back to the status for a %i without an envelope', (status, code) => {
    expect(toApiError(httpError(status, '<html>Bad gateway</html>')).code).toBe(code);
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT'])(
    'treats %s without a response as a timeout',
    (axiosCode) => {
      expect(toApiError(new AxiosError('timeout of 30000ms exceeded', axiosCode)).code).toBe(
        'TIMEOUT',
      );
    },
  );

  it('treats a request without a response as a network failure', () => {
    expect(toApiError(new AxiosError('Network Error', 'ERR_NETWORK')).code).toBe('NETWORK');
  });

  it('keeps an ApiError as it is and wraps anything else as internal', () => {
    const apiError = new ApiError('NOT_FOUND', 'File not found');
    expect(toApiError(apiError)).toBe(apiError);
    expect(toApiError(new Error('boom'))).toMatchObject({ code: 'INTERNAL', message: 'boom' });
  });
});

describe('getErrorMessage', () => {
  it.each([
    ['UNAUTHENTICATED', 'Your session has expired. Please sign in again.'],
    ['NOT_FOUND', 'The item could not be found. It may have been deleted.'],
    ['PAYLOAD_TOO_LARGE', 'File is too large. The maximum size is 4 MB.'],
    ['UNSUPPORTED_MEDIA_TYPE', 'Only PDF files are accepted.'],
    ['RATE_LIMITED', 'Too many requests. Please wait a few minutes and try again.'],
    ['NETWORK', 'Unable to connect. Please check your internet connection and try again.'],
    ['TIMEOUT', 'The request timed out. Please try again.'],
    ['INTERNAL', 'Something went wrong on our end. Please try again in a few moments.'],
  ] as const)("explains %s in the user's terms", (code, message) => {
    expect(getErrorMessage(new ApiError(code, 'server text'))).toBe(message);
  });

  it.each(['CONFLICT', 'VALIDATION_FAILED'] as const)(
    'shows the server message for %s, which names the clash or the field',
    (code) => {
      expect(getErrorMessage(new ApiError(code, 'Name is required'))).toBe('Name is required');
      expect(getErrorMessage(new ApiError(code, ''))).not.toBe('');
    },
  );

  it('explains anything that is not an ApiError as an internal error', () => {
    expect(getErrorMessage(new Error('x'))).toBe(
      'Something went wrong on our end. Please try again in a few moments.',
    );
  });
});
