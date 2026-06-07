import type { RequestHandler } from 'express';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { findUserProfileById } from '../repositories/user.repository.js';

export const authMiddleware: RequestHandler = asyncHandler(async (req, _res, next) => {
  let token: string | undefined;

  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken as string;
  }

  if (!token) {
    throw new ApiError(401, 'Unauthorized');
  }

  const { userId } = verifyAccessToken(token);

  const user = await findUserProfileById(userId);

  if (!user) {
    throw new ApiError(401, 'User not found');
  }

  req.user = user;

  next();
});