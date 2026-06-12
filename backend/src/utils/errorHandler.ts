import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from 'jsonwebtoken';

import { ApiError } from "../utils/apiError.js";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
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

  console.error("Unexpected error:", err.message);

  return res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};