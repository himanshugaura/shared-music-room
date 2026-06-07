import argon from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { ApiError } from '../utils/apiError.js';
import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '../utils/jwt.js';
import { verificationEmailSender } from '../utils/sendMail.js';
import { createUser, findUserByEmail, findUserById, updateUserById } from '../repositories/auth.repository.js';
import type { AuthTokenResponse, RegisterResponse } from '../types/auth.types.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const registerUser = async (
  email: string,
  password: string,
): Promise<RegisterResponse> => {
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

export const loginUser = async (
  email: string,
  password: string,
): Promise<AuthTokenResponse> => {
  const user = await findUserByEmail(email);

  if (!user) throw new ApiError(401, 'Invalid credentials');
  if (user.provider === 'google') throw new ApiError(401, 'This account uses Google sign-in');

  const isValid = await argon.verify(user.password!, password);
  if (!isValid) throw new ApiError(401, 'Invalid credentials');

  const { accessToken, refreshToken } = await generateAndStoreTokens(user.id);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, isVerified: user.isVerified },
  };
};

export const googleAuthUser = async (credential: string): Promise<AuthTokenResponse> => {
  if (!credential) throw new ApiError(400, 'Google credential is required');

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

  const { accessToken, refreshToken } = await generateAndStoreTokens(user.id);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, isVerified: user.isVerified },
  };
};

export const logoutUser = async (userId: string): Promise<void> => {
  await updateUserById(userId, { refreshToken: null });
};

export const refreshTokens = async (
  incomingRefreshToken: string,
): Promise<{ newAccessToken: string; newRefreshToken: string }> => {
  if (!incomingRefreshToken) throw new ApiError(401, 'Unauthorized');

  const tokenPayload = verifyRefreshToken(incomingRefreshToken);
  const user = await findUserById(tokenPayload.userId);

  if (!user) throw new ApiError(401, 'User not found');
  if (!user.refreshToken) throw new ApiError(401, 'Unauthorized');

  const isValid = await argon.verify(user.refreshToken, incomingRefreshToken);
  if (!isValid) throw new ApiError(401, 'Unauthorized');

  const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
    await generateAndStoreTokens(user.id);

  return { newAccessToken, newRefreshToken };
};

export const sendVerificationEmailToUser = async (userId: string): Promise<void> => {
  const user = await findUserById(userId);

  if (!user) throw new ApiError(404, 'User not found');
  if (user.isVerified) throw new ApiError(400, 'Email is already verified');

  await verificationEmailSender({ to: user.email, url: buildVerificationUrl(user.id) });
};

export const verifyEmailToken = async (token: string): Promise<void> => {
  const tokenPayload = verifyAccessToken(token);
  const user = await findUserById(tokenPayload.userId);

  if (!user) throw new ApiError(404, 'User not found');
  if (user.isVerified) throw new ApiError(400, 'Email is already verified');

  await updateUserById(user.id, { isVerified: true });
};

const buildVerificationUrl = (userId: string): string => {
  const token = generateAccessToken({ userId });
  return `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
};

const generateAndStoreTokens = async (
  userId: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = generateAccessToken({ userId });
  const refreshToken = generateRefreshToken({ userId });
  const hashed = await argon.hash(refreshToken);
  await updateUserById(userId, { refreshToken: hashed });
  return { accessToken, refreshToken };
};