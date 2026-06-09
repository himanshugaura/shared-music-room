import type { RequestHandler } from 'express';

import { findUserProfileById } from '../repositories/user.repository.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/jwt.js';

export const authMiddleware: RequestHandler = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : (req.cookies?.accessToken as string | undefined);

  if (!token) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { userId } = verifyAccessToken(token);

  const user = await findUserProfileById(userId);

  if (!user) {
    throw new ApiError(401, 'User not found');
  }

  req.user = {
    id: user.id,
    email: user.email,
    isVerified: user.isVerified,
  };

  next();
});