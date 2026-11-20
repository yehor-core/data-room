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
    next(
      new AppError('VALIDATION_FAILED', details.map((detail) => detail.message).join(' '), details),
    );
  },
];

/** How long a name may be, in characters after trimming. */
const NAME_LENGTH = {
  dataRoom: { min: 3, max: 100 },
  folder: { min: 1, max: 100 },
  file: { min: 1, max: 255 },
};

/** A required name, trimmed, as long as names of this kind may be. */
export const nameRule = (kind: keyof typeof NAME_LENGTH) => {
  const { min, max } = NAME_LENGTH[kind];
  return body('name')
    .isString()
    .withMessage('Name is required')
    .bail()
    .trim()
    .isLength({ min, max })
    .withMessage(`Name must be between ${min} and ${max} characters`);
};

/** An id field; absent, null and empty all mean "none" and leave the field undefined for the route. */
export const optionalId = (field: string, location = body) =>
  location(field)
    .customSanitizer((value) => value || undefined)
    .optional()
    .isString()
    .withMessage(`${field} must be a string`);

export const requiredId = (field: string) =>
  body(field)
    .isString()
    .withMessage(`${field} is required`)
    .bail()
    .notEmpty()
    .withMessage(`${field} is required`);
