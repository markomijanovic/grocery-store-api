import { ZodError } from 'zod';
import { AppError } from './errors.js';

export const validate = (schema, source) => (req, res, next) => {
  req.validated ??= {};
  req.validated[source] = schema.parse(req[source]);
  next();
};

export const errorHandler = (logger = console) => (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  let details;

  if (error instanceof AppError) {
    ({ status, code, message } = error);
  } else if (error instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid request data.';
    details = error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (error.code === 11000) {
    status = 409;
    code = error.keyPattern?.email ? 'EMAIL_CONFLICT' : 'RESOURCE_CONFLICT';
    message = error.keyPattern?.email
      ? 'Email is already in use.'
      : 'Resource already exists.';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body must contain valid JSON.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body exceeds the allowed size.';
  }

  if (status === 500) {
    logger.error({
      event: 'request_failed',
      requestId: req.id,
      errorName: error.name,
    });
  }

  res.status(status).json({
    error: { code, message, ...(details ? { details } : {}) },
  });
};
