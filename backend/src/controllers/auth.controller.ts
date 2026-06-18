import type { CookieOptions, Request, Response } from 'express';
import {
  googleAuthUser,
  loginUser,
  logoutUser,
  refreshTokens,
  registerUser,
} from '../services/auth.service.js';
import type { GoogleAuthBody, LoginBody, RegisterBody } from '../types/auth.types.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyRefreshToken } from '../utils/jwt.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  maxAge: 15 * 60 * 1000,
  path: '/',
};

const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

const CLEAR_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  path: '/',
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  res.cookie('accessToken', accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, name, password } = req.body as RegisterBody;

  const { accessToken, refreshToken, user } = await registerUser(username, name, password);

  setAuthCookies(res, accessToken, refreshToken);

  return new ApiResponse(201, user, 'User registered successfully').send(res);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as LoginBody;

  const { accessToken, refreshToken, user } = await loginUser(username, password);

  setAuthCookies(res, accessToken, refreshToken);

  return new ApiResponse(200, user, 'User logged in successfully').send(res);
});

export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as GoogleAuthBody;

  const { accessToken, refreshToken, user } = await googleAuthUser(code);

  setAuthCookies(res, accessToken, refreshToken);

  return new ApiResponse(200, user, 'User authenticated with Google successfully').send(res);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (refreshToken) {
    try {
      const { sessionId } = verifyRefreshToken(refreshToken);
      await logoutUser(sessionId);
    } catch {
      // ignore errors — still clear cookies
    }
  }

  res
    .clearCookie('accessToken', CLEAR_COOKIE_OPTIONS)
    .clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS);

  return new ApiResponse(200, null, 'User logged out successfully').send(res);
});

export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken = req.cookies?.refreshToken as string | undefined;

  try {
    const { newAccessToken, newRefreshToken } = await refreshTokens(incomingRefreshToken!);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return new ApiResponse(200, null, 'Tokens refreshed successfully').send(res);
  } catch (error) {
    res
      .clearCookie('accessToken', CLEAR_COOKIE_OPTIONS)
      .clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS);

    throw error;
  }
});