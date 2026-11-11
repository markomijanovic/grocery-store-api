export class AppError extends Error {
  constructor(status, code, message) {
    super(message);

    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export const unauthenticated = () => new AppError(
  401,
  'UNAUTHENTICATED',
  'A valid access token is required.',
);

export const forbidden = () => new AppError(
  403,
  'FORBIDDEN',
  'This action is not allowed.',
);

export const notFound = () => new AppError(
  404,
  'RESOURCE_NOT_FOUND',
  'Resource not found.',
);