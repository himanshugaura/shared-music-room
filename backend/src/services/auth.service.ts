import argon from 'argon2';
import { OAuth2Client } from 'google-auth-library';

import {
  createRefreshSession,
   createUser,
  deleteExpiredRefreshSessions,
  deleteRefreshSessionById,
  findUserByEmail,
  findUserById,
  updateRefreshSessionToken,
  updateUserById,
  findRefreshSessionById,
} from '../repositories/auth.repository.js';
import type {
  AuthTokenResponse,
  AuthUser,
  RegisterResponse,
} from '../types/auth.types.js';
import { ApiError } from '../utils/apiError.js';
import {
  generateAccessToken,
  generateEmailVerificationToken,
  generateRefreshToken,
  verifyEmailVerificationToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { verificationEmailSender } from '../utils/sendMail.js';
import { nanoid } from 'nanoid';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const toAuthUser = (user: {
  id: string;
  email: string;
  name: string | null;
  isVerified: boolean;
  avatarUrl: string | null;
}): AuthUser => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isVerified: user.isVerified,
    avatarUrl: user.avatarUrl,
  };
};

const buildVerificationUrl = (userId: string): string => {
  const token = generateEmailVerificationToken({ userId });
  return `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
};

const createSessionAndTokens = async (
  userId: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const sessionId = nanoid();
  const refreshToken = generateRefreshToken({ userId, sessionId });
  const hashedRefreshToken = await argon.hash(refreshToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await createRefreshSession({
    sessionId,
    userId,
    refreshToken: hashedRefreshToken,
    expiresAt,
  });

  const accessToken = generateAccessToken({ userId });

  return { accessToken, refreshToken };
};

export const registerUser = async (email: string, password: string): Promise<RegisterResponse> => {
  const existing = await findUserByEmail(email);

  if (existing) {
    const message =
      existing.provider === 'google'
        ? 'Account already exists. Continue with Google.'
        : 'Account already exists.';
    throw new ApiError(409, message);
  }

  const hashedPassword = await argon.hash(password);
  const user = await createUser({ email, password: hashedPassword });

  const verificationUrl = buildVerificationUrl(user.id);
  await verificationEmailSender({ to: user.email, url: verificationUrl });

  return { id: user.id, email: user.email };
};

export const loginUser = async (email: string, password: string): Promise<AuthTokenResponse> => {
  const user = await findUserByEmail(email);

  if (!user) {throw new ApiError(401, 'Invalid credentials');}
  if (user.provider === 'google') {throw new ApiError(401, 'This account uses Google sign-in');}
  if (!user.password) {throw new ApiError(401, 'Invalid credentials');}

  const isValid = await argon.verify(user.password, password);
  if (!isValid) {throw new ApiError(401, 'Invalid credentials');}

  const { accessToken, refreshToken } = await createSessionAndTokens(user.id);

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user),
  };
};

export const googleAuthUser = async (credential: string): Promise<AuthTokenResponse> => {
  if (!credential) {throw new ApiError(400, 'Google credential is required');}

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID!,
  });

  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    throw new ApiError(401, 'Invalid Google token');
  }

  let user = await findUserByEmail(payload.email);

  if (user && user.provider !== 'google') {
    throw new ApiError(409, 'Account already exists with email/password');
  }

  if (!user) {
    user = await createUser({
      email: payload.email,
      name: payload.name ?? '',
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
      provider: 'google',
      isVerified: true,
    });
  }

  const { accessToken, refreshToken } = await createSessionAndTokens(user.id);

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user),
  };
};

export const logoutUser = async ( sessionId: string): Promise<void> => {
  await deleteRefreshSessionById( sessionId);
};

export const refreshTokens = async (
  incomingRefreshToken: string,
): Promise<{ newAccessToken: string; newRefreshToken: string }> => {
  if (!incomingRefreshToken) {throw new ApiError(401, 'Unauthorized');}

  const tokenPayload = verifyRefreshToken(incomingRefreshToken);
  const session = await findRefreshSessionById(tokenPayload.sessionId);

  if (!session) {throw new ApiError(401, 'Unauthorized');}

  if (session.expiresAt.getTime() <= Date.now()) {
    await deleteRefreshSessionById(tokenPayload.sessionId);
    throw new ApiError(401, 'Session expired');
  }

  const isValid = await argon.verify(session.refreshToken, incomingRefreshToken);
  if (!isValid) {
    await deleteRefreshSessionById(tokenPayload.sessionId);
    throw new ApiError(401, 'Unauthorized');
  }

  const newRefreshToken = generateRefreshToken({
    userId: tokenPayload.userId,
    sessionId: session.id,
  });
  const hashedNewRefreshToken = await argon.hash(newRefreshToken);

  const newAccessToken = generateAccessToken({ userId: tokenPayload.userId });

  await updateRefreshSessionToken(session.id, hashedNewRefreshToken);

  return {
    newAccessToken,
    newRefreshToken,
  };
};

export const sendVerificationEmailToUser = async (userId: string): Promise<void> => {
  const user = await findUserById(userId);

  if (!user) {throw new ApiError(404, 'User not found');}
  if (user.isVerified) {throw new ApiError(400, 'Email is already verified');}

  await verificationEmailSender({
    to: user.email,
    url: buildVerificationUrl(user.id),
  });
};

export const sendVerificationEmailByEmail = async (email: string): Promise<void> => {
  const user = await findUserByEmail(email);

  if (!user) {throw new ApiError(404, 'User not found');}
  if (user.isVerified) {throw new ApiError(400, 'Email is already verified');}

  await verificationEmailSender({
    to: user.email,
    url: buildVerificationUrl(user.id),
  });
};

export const verifyEmailToken = async (token: string): Promise<void> => {
  const tokenPayload = verifyEmailVerificationToken(token);
  const user = await findUserById(tokenPayload.userId);

  if (!user) {throw new ApiError(404, 'User not found');}
  if (user.isVerified) {throw new ApiError(400, 'Email is already verified');}

  await updateUserById(user.id, { isVerified: true });
};

export const cleanupExpiredSessions = async (): Promise<number> => {
  return deleteExpiredRefreshSessions();
};