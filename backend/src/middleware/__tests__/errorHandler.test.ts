import multer from 'multer';
import { AppError } from '../../errors';
import { toErrorResponse } from '../errorHandler';

describe('toErrorResponse', () => {
  it.each([
    ['UNAUTHENTICATED', 401],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['VALIDATION_FAILED', 400],
    ['PAYLOAD_TOO_LARGE', 413],
    ['UNSUPPORTED_MEDIA_TYPE', 415],
    ['INTERNAL', 500],
  ] as const)('maps %s to %i', (code, status) => {
    expect(toErrorResponse(new AppError(code, 'Something'))).toEqual({
      status,
      body: { success: false, error: { code, message: 'Something' } },
    });
  });

  it('includes validation details', () => {
    const details = [{ field: 'name', message: 'Name is required' }];

    expect(
      toErrorResponse(new AppError('VALIDATION_FAILED', 'Name is required', details)).body.error,
    ).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Name is required',
      details,
    });
  });

  it('maps an oversized multer upload to PAYLOAD_TOO_LARGE with the limit in the message', () => {
    expect(toErrorResponse(new multer.MulterError('LIMIT_FILE_SIZE', 'file'))).toEqual({
      status: 413,
      body: {
        success: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'File is larger than the 4 MB limit' },
      },
    });
  });

  it('maps other multer errors to VALIDATION_FAILED for the field', () => {
    expect(
      toErrorResponse(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'document')),
    ).toMatchObject({
      status: 400,
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          details: [{ field: 'document', message: expect.any(String) }],
        },
      },
    });
  });

  it.each([
    [{ type: 'entity.parse.failed', status: 400 }, 400, 'VALIDATION_FAILED'],
    [{ type: 'entity.too.large', status: 413 }, 413, 'PAYLOAD_TOO_LARGE'],
  ])('maps body parser error %j', (error, status, code) => {
    expect(toErrorResponse(Object.assign(new Error('parser'), error))).toMatchObject({
      status,
      body: { error: { code } },
    });
  });

  it('hides anything else behind INTERNAL', () => {
    expect(toErrorResponse(new Error('connection to db.internal:5432 refused'))).toEqual({
      status: 500,
      body: { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    });
  });
});
