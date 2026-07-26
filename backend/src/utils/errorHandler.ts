import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { ApiError } from './apiError.js';
import { logger } from './logger.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint error handler requires 4-param signature even if _next is unused
  _next: NextFunction,
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err instanceof jwt.TokenExpiredError || err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }

  logger.error({ err }, 'Unexpected error');

  return res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};