import type { Socket } from 'socket.io';
import { findUserProfileById } from '../../repositories/user.repository.js';
import { verifyAccessToken } from '../../utils/jwt.js';
import type { AuthenticatedSocket } from '../types.js';

const extractToken = (socket: Socket): string | undefined => {
  const { auth, headers } = socket.handshake;

  if (auth?.token) return auth.token as string;

  const authHeader = headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);

  return headers.cookie
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('accessToken='))
    ?.slice('accessToken='.length);
};

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> => {
  try {
    const token = extractToken(socket);

    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    const payload = verifyAccessToken(token);
    const user = await findUserProfileById(payload.userId);

    if (!user) {
      next(new Error('User not found'));
      return;
    }

    (socket as AuthenticatedSocket).user = {
      id: user.id,
      email: user.email,
      isVerified: user.isVerified,
    };

    next();
  } catch {
    next(new Error('Unauthorized'));
  }
};
