import { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { AppError, ErrorCode, ErrorDetail } from '../errors';
import { Logger } from '../lib/logger';
import { FILE_TOO_LARGE_MESSAGE } from '../access/uploads';

const statusByCode: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INTERNAL: 500,
};

interface ErrorResponse {
  status: number;
  body: { success: false; error: { code: ErrorCode; message: string; details?: ErrorDetail[] } };
}

const respond = (code: ErrorCode, message: string, details?: ErrorDetail[]): ErrorResponse => ({
  status: statusByCode[code],
  body: { success: false, error: { code, message, ...(details && { details }) } },
});

/** Body parser errors carry the HTTP status they stand for and a `type` such as 'entity.parse.failed'. */
const isBodyParserError = (error: unknown): error is { status: number; type: string } =>
  typeof error === 'object' && error !== null && 'type' in error && 'status' in error;

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof AppError) return respond(error.code, error.message, error.details);
  if (error instanceof multer.MulterError) {
    return error.code === 'LIMIT_FILE_SIZE'
      ? respond('PAYLOAD_TOO_LARGE', FILE_TOO_LARGE_MESSAGE)
      : respond('VALIDATION_FAILED', error.message, [{ field: error.field ?? 'file', message: error.message }]);
  }
  if (isBodyParserError(error)) {
    return error.status === 413
      ? respond('PAYLOAD_TOO_LARGE', 'Request body is too large')
      : respond('VALIDATION_FAILED', 'Request body is not valid JSON');
  }
  return respond('INTERNAL', 'Internal server error');
}

export const errorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (error, req, res, _next) => {
    const { status, body } = toErrorResponse(error);
    if (status === 500) logger.error(`Unhandled error on ${req.method} ${req.path}`, error);
    res.status(status).json(body);
  };

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError('NOT_FOUND', 'Route not found'));
