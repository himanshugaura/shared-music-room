import type { NextFunction, Request, RequestHandler,Response } from 'express';
import type {ZodSchema } from 'zod';

import { ApiError } from '../utils/apiError.js';

export const validate = (schema: ZodSchema): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errors = (result.error).issues.map((issue) => issue.message);
      return next(new ApiError(400, 'Validation failed', errors));
    }

    req.body = result.data;

    next();
  };
};