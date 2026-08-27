import type { Socket } from 'socket.io';

export type OnlineUser = {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type SocketUser = OnlineUser & {
  email: string | null;
};

export type AuthenticatedSocket = Socket & {
  user: SocketUser;
};

export type AckResponse<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; message: string };
