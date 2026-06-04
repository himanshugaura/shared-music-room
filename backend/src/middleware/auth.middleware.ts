import type { RequestHandler } from "express";
import { prisma } from "../config/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "../utils/jwt.js";

export const authMiddleware: RequestHandler =
  asyncHandler(async (req, res, next) => {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      throw new ApiError(
        401,
        "Unauthorized"
      );
    }

    const token =
      authHeader.split(" ")[1];
    
    if (!token) {
      throw new ApiError(
        401,
        "Unauthorized"
      );
    }

  const payload = verifyAccessToken(token);

    const user =
      await prisma.user.findUnique({
        where: {
          id: payload.userId,
        },
      });

    if (!user) {
      throw new ApiError(
        401,
        "User not found"
      );
    }

    req.user = user;

    next();
  });