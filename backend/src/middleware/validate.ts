import { z } from "zod";
import type {
  Request,
  Response,
  NextFunction,
} from "express";
import { ApiError } from "../utils/apiError.js";

export const validate = (schema: z.ZodSchema) => {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      return next(
        new ApiError(
          400,
          "Validation failed",
          result.error.issues.map(
            (issue) => issue.message
          )
        )
      );
    }

    next();
  };
};