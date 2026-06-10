import type { CookieOptions,Request, Response } from 'express';
import {
  googleAuthUser,
  loginUser,
  logoutUser,
  refreshTokens,
  registerUser,
  sendVerificationEmailByEmail,
  sendVerificationEmailToUser,
  verifyEmailToken,
} from '../services/auth.service.js';
import type { GoogleAuthBody,LoginBody, RegisterBody } from '../types/auth.types.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyRefreshToken } from '../utils/jwt.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000,
  path: '/',
};

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

const CLEAR_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'lax',
  path: '/',
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as RegisterBody;

  const user = await registerUser(email, password);

  return new ApiResponse(201, user, 'User registered successfully').send(res);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginBody;

  const { accessToken, refreshToken, user } = await loginUser(email, password);

  setAuthCookies(res, accessToken, refreshToken);

  return new ApiResponse(200, user, 'User logged in successfully').send(res);
});

export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const { credential } = req.body as GoogleAuthBody;

  const { accessToken, refreshToken, user } = await googleAuthUser(credential);

  setAuthCookies(res, accessToken, refreshToken);

  return new ApiResponse(200, user, 'User authenticated with Google successfully').send(res);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token is required');
  }

  const { sessionId } = verifyRefreshToken(refreshToken);

  await logoutUser(sessionId);

  res
    .clearCookie('accessToken', CLEAR_COOKIE_OPTIONS)
    .clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS);

  return new ApiResponse(200, null, 'User logged out successfully').send(res);
});

export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken = req.cookies?.refreshToken as string | undefined;

  const { newAccessToken, newRefreshToken } = await refreshTokens(incomingRefreshToken!);

  setAuthCookies(res, newAccessToken, newRefreshToken);

  return new ApiResponse(200, null, 'Tokens refreshed successfully').send(res);
});

export const sendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.id) {
    await sendVerificationEmailToUser(req.user.id);
  } else {
    const { email } = req.body as { email: string };
    await sendVerificationEmailByEmail(email);
  }

  return new ApiResponse(200, null, 'Verification email sent').send(res);
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.query as { token?: string };

  if (!token) {throw new ApiError(400, 'Verification token is required');}

  await verifyEmailToken(token);

  return new ApiResponse(200, null, 'Email verified successfully').send(res);
});