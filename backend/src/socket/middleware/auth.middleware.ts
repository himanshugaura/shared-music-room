import type { Socket } from 'socket.io';
import { getUserProfileById } from '../../modules/user/user.service.js';
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
    const user = await getUserProfileById(payload.userId);

    if (!user) {
      next(new Error('User not found'));
      return;
    }

    (socket as AuthenticatedSocket).user = {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      username: user.username ?? null,
      avatarUrl: user.avatarUrl ?? null,
    };

    next();
  } catch {
    next(new Error('Unauthorized'));
  }
};
