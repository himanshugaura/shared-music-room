import type { Prisma, RefreshSession, User } from '@prisma/client';

import { prisma } from '../config/prisma.js';

export const findUserByEmail = async (email: string): Promise<User | null> => {
  return prisma.user.findUnique({ where: { email } });
};

export const findUserByUsername = async (username: string): Promise<User | null> => {
  return prisma.user.findUnique({ where: { username } });
};

export const findUserById = async (id: string): Promise<User | null> => {
  return prisma.user.findUnique({ where: { id } });
};

export const createUser = async (data: Prisma.UserCreateInput): Promise<User> => {
  return prisma.user.create({ data });
};

export const updateUserById = async (
  id: string,
  data: Prisma.UserUpdateInput,
): Promise<User> => {
  return prisma.user.update({ where: { id }, data });
};

export const createRefreshSession = async (data: {
  sessionId: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
}): Promise<RefreshSession> => {
  return prisma.refreshSession.create({
    data: {
      id: data.sessionId,
      userId: data.userId,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
    },
  });
};

export const findRefreshSessionById = async (
  sessionId: string,
): Promise<RefreshSession | null> => {
  return prisma.refreshSession.findUnique({ where: { id: sessionId } });
};

export const updateRefreshSessionToken = async (
  sessionId: string,
  refreshToken: string,
): Promise<RefreshSession> => {
  return prisma.refreshSession.update({
    where: { id: sessionId },
    data: { refreshToken },
  });
};

export const deleteRefreshSessionById = async (sessionId: string): Promise<void> => {
  await prisma.refreshSession.delete({ where: { id: sessionId } });
};

export const deleteExpiredRefreshSessions = async (): Promise<number> => {
  const result = await prisma.refreshSession.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
  return result.count;
};