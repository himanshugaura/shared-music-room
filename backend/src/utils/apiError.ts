export class ApiError extends Error {
  readonly statusCode: number;
  readonly success = false;
  readonly errors: string[];

  constructor(
    statusCode: number,
    message = "Something went wrong",
    errors: string[] = []
  ) {
    super(message);

    Object.setPrototypeOf(this, ApiError.prototype);

    this.statusCode = statusCode;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}