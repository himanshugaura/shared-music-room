import argon from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { nanoid } from 'nanoid';

import {
  createRefreshSession,
  createUser,
  deleteRefreshSessionById,
  findRefreshSessionById,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  updateRefreshSessionToken,
} from '../repositories/auth.repository.js';
import type {
  AuthTokenResponse,
  AuthUser,
} from '../types/auth.types.js';
import { ApiError } from '../utils/apiError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';

const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
});

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const toAuthUser = (user: {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}): AuthUser => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl,
});

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

export const registerUser = async (
  username: string,
  name: string,
  password: string,
): Promise<AuthTokenResponse> => {
  const existing = await findUserByUsername(username);

  if (existing) {
    throw new ApiError(409, 'Username is already taken');
  }

  const hashedPassword = await argon.hash(password);
  const user = await createUser({ username, name, password: hashedPassword });

  const { accessToken, refreshToken } = await createSessionAndTokens(user.id);

  return { accessToken, refreshToken, user: toAuthUser(user) };
};

export const loginUser = async (
  username: string,
  password: string,
): Promise<AuthTokenResponse> => {
  const user = await findUserByUsername(username);

  if (!user) { throw new ApiError(401, 'Invalid credentials'); }
  if (user.provider === 'google') { throw new ApiError(401, 'This account uses Google sign-in'); }
  if (!user.password) { throw new ApiError(401, 'Invalid credentials'); }

  const isValid = await argon.verify(user.password, password);
  if (!isValid) { throw new ApiError(401, 'Invalid credentials'); }

  const { accessToken, refreshToken } = await createSessionAndTokens(user.id);

  return { accessToken, refreshToken, user: toAuthUser(user) };
};

export const googleAuthUser = async (code: string): Promise<AuthTokenResponse> => {
  if (!code) {
    throw new ApiError(400, 'Authorization code is required');
  }

  const { tokens } = await googleClient.getToken({
    code,
    redirect_uri: 'postmessage',
  });

  if (!tokens.id_token) {
    throw new ApiError(401, 'Google did not return an ID token');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID!,
  });

  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    throw new ApiError(401, 'Invalid Google token');
  }

  let user = await findUserByEmail(payload.email);

  if (user && user.provider !== 'google') {
    throw new ApiError(409, 'Account already exists with username/password');
  }

  if (!user) {
    user = await createUser({
      email: payload.email,
      name: payload.name ?? '',
      googleId: payload.sub,
      avatarUrl: payload.picture ?? null,
      provider: 'google',
    });
  }

  const { accessToken, refreshToken } = await createSessionAndTokens(user.id);

  return { accessToken, refreshToken, user: toAuthUser(user) };
};

export const logoutUser = async (sessionId: string): Promise<void> => {
  await deleteRefreshSessionById(sessionId);
};

export const refreshTokens = async (
  incomingRefreshToken: string,
): Promise<{ newAccessToken: string; newRefreshToken: string }> => {
  if (!incomingRefreshToken) { throw new ApiError(401, 'Unauthorized'); }

  const tokenPayload = verifyRefreshToken(incomingRefreshToken);
  const session = await findRefreshSessionById(tokenPayload.sessionId);

  if (!session) { throw new ApiError(401, 'Unauthorized'); }

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

  return { newAccessToken, newRefreshToken };
};