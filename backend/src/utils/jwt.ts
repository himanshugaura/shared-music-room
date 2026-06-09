import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const EMAIL_SECRET = process.env.JWT_EMAIL_SECRET || ACCESS_SECRET;

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '30d';
const EMAIL_TOKEN_EXPIRES_IN = '1d';

export type AccessTokenPayload = {
  userId: string;
};

export type RefreshTokenPayload = {
  userId: string;
  sessionId: string;
};

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
};

export const generateEmailVerificationToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, EMAIL_SECRET, { expiresIn: EMAIL_TOKEN_EXPIRES_IN });
};

export const verifyEmailVerificationToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, EMAIL_SECRET) as AccessTokenPayload;
};