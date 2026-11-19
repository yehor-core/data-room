import { RequestHandler } from 'express';
import { body, ValidationChain, validationResult } from 'express-validator';
import { AppError } from '../errors';

/** Runs the chains and turns their failures into one VALIDATION_FAILED error with a detail per field. */
export const validate = (...chains: ValidationChain[]): RequestHandler[] => [
  ...chains,
  (req, _res, next) => {
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length === 0) return next();
    const details = errors.map((error) => ({
      field: error.type === 'field' ? error.path : error.type,
      message: String(error.msg),
    }));
    next(new AppError('VALIDATION_FAILED', details.map((detail) => detail.message).join(' '), details));
  },
];

/** A required name, trimmed, between `min` and `max` characters. */
export const nameRule = (min: number, max: number) =>
  body('name')
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min, max })
    .withMessage(`Name must be between ${min} and ${max} characters`);

/** An id field; absent, null and empty all mean "none". */
export const optionalId = (field: string, location = body) =>
  location(field).optional({ values: 'falsy' }).isString().withMessage(`${field} must be a string`);

export const requiredId = (field: string) => body(field).isString().notEmpty().withMessage(`${field} is required`);
